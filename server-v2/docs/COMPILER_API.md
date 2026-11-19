# Compiler & Code Execution API Documentation (Backend V2)

## 1. Overview & Purpose

The Compiler Module provides secure, isolated remote code execution for the CoCode browser-based IDE workspace. It connects to an isolated Judge0 CE execution engine, handling payload construction, base64 encoding/decoding, asynchronous execution polling, status normalization, and strict security guards.

All code submitted to this API is executed strictly in an isolated sandbox environment by Judge0 with conservative CPU, memory, and wall-clock execution limits. The CoCode backend server itself never executes untrusted user source code.

---

## 2. Authentication

All endpoints in the Compiler API require a valid JWT Bearer token obtained from `/api/auth/login` or `/api/auth/register`.

```http
Authorization: Bearer <access_token>
```

Unauthenticated requests or requests with expired/tampered tokens return `401 Unauthorized`.

---

## 3. Supported Programming Languages

Language configurations and Judge0 runtime IDs are centralized in `server-v2/src/config/languages.js`:

| Key | Display Name | Runtime & Compiler | Extension | Judge0 ID | Supported Aliases |
|---|---|---|---|---|---|
| `c` | C | GCC 14.1.0 | `.c` | 103 | `c` |
| `cpp` | C++ | GCC 14.1.0 | `.cpp` | 105 | `cpp`, `c++` |
| `java` | Java | OpenJDK 17.0.6 | `.java` | 91 | `java` |
| `python` | Python | Python 3.12.5 | `.py` | 100 | `python`, `py`, `python3` |
| `javascript` | JavaScript | Node.js 22.08.0 | `.js` | 102 | `javascript`, `js`, `node` |

---

## 4. Endpoints

### 4.1. GET `/api/compiler/languages`

Retrieves safe metadata for all supported execution runtimes. Sensitive internal configurations (API keys, hostnames) are strictly excluded.

- **Method**: `GET`
- **Authentication**: Required (`Bearer <token>`)
- **Rate Limit**: General API limit (or authenticated user quota)

#### Success Response (`200 OK`)

```json
{
  "success": true,
  "languages": [
    {
      "key": "c",
      "name": "C",
      "runtime": "GCC 14.1.0",
      "version": "14.1.0",
      "extension": ".c",
      "monacoLanguage": "c",
      "judge0Id": 103,
      "aliases": ["c"]
    },
    {
      "key": "cpp",
      "name": "C++",
      "runtime": "GCC 14.1.0",
      "version": "14.1.0",
      "extension": ".cpp",
      "monacoLanguage": "cpp",
      "judge0Id": 105,
      "aliases": ["cpp", "c++"]
    },
    {
      "key": "java",
      "name": "Java",
      "runtime": "OpenJDK 17",
      "version": "17.0.6",
      "extension": ".java",
      "monacoLanguage": "java",
      "judge0Id": 91,
      "aliases": ["java"]
    },
    {
      "key": "python",
      "name": "Python",
      "runtime": "Python 3.12.5",
      "version": "3.12.5",
      "extension": ".py",
      "monacoLanguage": "python",
      "judge0Id": 100,
      "aliases": ["python", "py", "python3"]
    },
    {
      "key": "javascript",
      "name": "JavaScript",
      "runtime": "Node.js 22.08.0",
      "version": "22.08.0",
      "extension": ".js",
      "monacoLanguage": "javascript",
      "judge0Id": 102,
      "aliases": ["javascript", "js", "node"]
    }
  ]
}
```

---

### 4.2. POST `/api/compiler/run`

Submits source code with optional standard input for execution in the Judge0 sandbox.

- **Method**: `POST`
- **Authentication**: Required (`Bearer <token>`)
- **Content-Type**: `application/json`
- **Rate Limit**: 20 requests per minute per user/IP

#### Request Body

| Field | Type | Required | Description | Constraints |
|---|---|---|---|---|
| `language` | `string` | Yes | Target language identifier or alias | Must be an allowlisted language (e.g. `python`, `cpp`, `js`) |
| `sourceCode` | `string` | Yes | Source code to compile and execute | Non-empty string, max 30,000 characters |
| `stdin` | `string` | No | Custom standard input text | Max 10,000 characters, defaults to `""` |

#### Request Example

```json
{
  "language": "cpp",
  "sourceCode": "#include <iostream>\nusing namespace std;\nint main() {\n  int a, b;\n  if (cin >> a >> b) cout << (a + b) << endl;\n  return 0;\n}",
  "stdin": "15 25"
}
```

#### Success Response (`200 OK`) — Execution Accepted

```json
{
  "success": true,
  "data": {
    "status": {
      "id": 3,
      "description": "Accepted"
    },
    "stdout": "40\n",
    "stderr": null,
    "compileOutput": null,
    "message": null,
    "time": "0.012",
    "memory": 2048,
    "language": "cpp"
  },
  "status": "Accepted",
  "stdout": "40\n",
  "stderr": "",
  "compileOutput": "",
  "message": "",
  "time": "0.012",
  "memory": 2048
}
```

> **Note on Compatibility**: The response returns both the structured Backend V2 envelope (`data: { ... }`) and top-level fields (`stdout`, `stderr`, `compileOutput`, `status`, `time`, `memory`) ensuring immediate zero-modification compatibility with the existing React frontend compiler component (`Compiler.jsx`).

#### Compilation Error Example (`200 OK`)

Compilation and runtime errors are execution outcomes, returned as HTTP `200 OK` with appropriate diagnostics:

```json
{
  "success": true,
  "data": {
    "status": {
      "id": 6,
      "description": "Compilation Error"
    },
    "stdout": null,
    "stderr": null,
    "compileOutput": "calculator.cpp:4:1: error: expected ';' before '}' token",
    "message": null,
    "time": null,
    "memory": null,
    "language": "cpp"
  },
  "status": "Compilation Error",
  "stdout": "",
  "stderr": "",
  "compileOutput": "calculator.cpp:4:1: error: expected ';' before '}' token",
  "message": "",
  "time": null,
  "memory": null
}
```

#### Runtime Error Example (`200 OK`)

```json
{
  "success": true,
  "data": {
    "status": {
      "id": 11,
      "description": "Runtime Error (NZEC)"
    },
    "stdout": null,
    "stderr": "ZeroDivisionError: division by zero",
    "compileOutput": null,
    "message": null,
    "time": "0.015",
    "memory": 3120,
    "language": "python"
  },
  "status": "Runtime Error (NZEC)",
  "stdout": "",
  "stderr": "ZeroDivisionError: division by zero",
  "compileOutput": "",
  "message": "",
  "time": "0.015",
  "memory": 3120
}
```

---

## 5. Security & Execution Limits

1. **Authentication Enforcement**: Only authenticated users with verified JWTs can invoke code execution.
2. **Payload Size Restrictions**:
   - `sourceCode`: Max 30,000 characters. Submissions exceeding this limit return HTTP `413 Payload Too Large`.
   - `stdin`: Max 10,000 characters. Submissions exceeding this limit return HTTP `400 Bad Request`.
3. **Execution Resource Limits (Judge0 Sandboxing)**:
   - `cpu_time_limit`: 2 seconds
   - `cpu_extra_time`: 1 second
   - `wall_time_limit`: 5 seconds
   - `memory_limit`: 128,000 KB (128 MB)
   - `enable_network`: `false` (network isolation disabled inside sandbox)
4. **Rate Limiting**:
   - 20 executions per minute per authenticated user (falling back to client IP address).
   - Exceeding the rate limit returns HTTP `429 Too Many Requests` with a `Retry-After` header.
5. **No Local Code Execution**:
   - The CoCode Node.js backend server executes 0% of user code locally.
   - User programs are never executed via `eval`, `Function`, `child_process`, or shell commands.
6. **Credential & Log Protection**:
   - Judge0 API tokens and bearer tokens are never output in error responses or console logs.
   - User source code and standard input are never dumped into application logs.
7. **Base64 Encoding**:
   - Submissions to Judge0 are Base64 encoded by default (`JUDGE0_USE_BASE64=true`) to avoid unicode or newline corruption and prevent command-injection vulnerabilities in upstream serializers.

---

## 6. Error Codes

| HTTP Status | Error Scenario | Response Example |
|---|---|---|
| `400 Bad Request` | Missing or empty source code, missing or unsupported language, invalid stdin | `{"success": false, "message": "Source code cannot be empty.", "error": "Source code cannot be empty."}` |
| `401 Unauthorized` | Missing, invalid, expired, or tampered JWT token | `{"success": false, "message": "Authentication token is required.", "error": "Authentication token is required."}` |
| `413 Payload Too Large` | Source code exceeds 30,000 characters | `{"success": false, "message": "Source code exceeds maximum allowed size of 30,000 characters.", "error": "..."}` |
| `429 Too Many Requests` | User or IP exceeded 20 executions per minute | `{"success": false, "message": "Too many code execution requests. Please wait a moment before trying again.", "retryAfter": 45}` |
| `502 Bad Gateway` | Judge0 upstream service is unreachable or returned invalid response | `{"success": false, "message": "Cannot reach the execution service. Check network connection.", "error": "..."}` |
| `503 Service Unavailable` | Judge0 upstream service is rate limited (429) or busy | `{"success": false, "message": "The compiler service is busy. Please try again shortly.", "error": "..."}` |
| `504 Gateway Timeout` | Judge0 submission or polling timed out | `{"success": false, "message": "The compiler service timed out. Please try again.", "error": "..."}` |
| `500 Internal Error` | Unhandled server exception | `{"success": false, "message": "Internal server error during code execution.", "error": "..."}` |

---

## 7. Environment Configuration

Add the following environment variables to `server-v2/.env` (examples provided in `server-v2/.env.example`):

```env
# Judge0 Compiler Configuration
JUDGE0_BASE_URL=https://ce.judge0.com
JUDGE0_API_KEY=
JUDGE0_TIMEOUT_MS=10000
JUDGE0_POLL_INTERVAL_MS=750
JUDGE0_MAX_POLL_ATTEMPTS=15
JUDGE0_USE_BASE64=true
```

- `JUDGE0_BASE_URL`: Base URL of the Judge0 service (default: `https://ce.judge0.com`).
- `JUDGE0_API_KEY`: Optional auth token (`X-Auth-Token` or `X-RapidAPI-Key`).
- `JUDGE0_TIMEOUT_MS`: Network timeout per request in milliseconds (default: `10000`).
- `JUDGE0_POLL_INTERVAL_MS`: Delay between status polling requests in milliseconds (default: `750`).
- `JUDGE0_MAX_POLL_ATTEMPTS`: Maximum status check attempts before aborting (default: `15`).
- `JUDGE0_USE_BASE64`: Whether to use base64 encoding for code submission and output retrieval (default: `true`).

---

## 8. Testing Instructions

From `C:\Users\jatin\CoCode\server-v2`:

### 8.1. Syntax & Static Verification

```powershell
npm run check
```

### 8.2. Deterministic Automated Tests (Mocked Judge0)

Runs all unit, regression, and integration tests:

```powershell
npm test
```

### 8.3. Optional Live Judge0 Smoke Test

To verify connectivity against a live, internet-accessible Judge0 instance:

```powershell
$env:TEST_REAL_JUDGE0="true"
node --test tests/compiler.external.test.js
```
