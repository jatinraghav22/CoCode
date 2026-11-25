# CoCode — Manual Verification Checklist

**Purpose**: Guide human QA testers and reviewers through visual, tactile, and multi-user verification scenarios that cannot be completely simulated via headless unit tests.  
**Auditor**: QA Automation Engineer & UI/UX Specialist  
**Date**: November 25, 2026  

---

## Pre-Requisites for Manual Verification

1. Backend V2 running locally (`cd server-v2 && npm start`) or live on Render (`https://cocode-backend-v2.onrender.com`).
2. Client running locally (`cd client && npm run dev`) or live on Vercel (`https://getcocode.vercel.app`).
3. Two modern browsers or one regular + one incognito window to simulate multiple concurrent users.

---

## 1. Visual & Responsive UI Checklist (Phase 3)

| Check ID | Verification Action | Expected Behavior | Tested By / Date | Status |
|---|---|---|:---:|:---:|
| **MAN-01** | Open application at `/` and resize viewport down to 375px (mobile) | Navigation bar collapses cleanly into mobile hamburger; no horizontal scrollbar overflow. | | [ ] PENDING |
| **MAN-02** | Open Monaco editor on `/editor` and toggle minimap from settings | Minimap appears and disappears smoothly without flickering or redrawing distortion. | | [ ] PENDING |
| **MAN-03** | Switch editor color themes (Dark, Light, Cyberpunk, Monokai) | Monaco editor syntax tokens, background colors, and toolbar change instantly with high contrast. | | [ ] PENDING |
| **MAN-04** | Press `Ctrl+P` (Quick Open) and `Ctrl+F` (Find in File) | Quick Open modal and Find/Replace floating toolbar appear with active keyboard focus. | | [ ] PENDING |

---

## 2. Real-Time Pair Programming & Presence Checklist (Phases 8 & 9)

| Check ID | Verification Action | Expected Behavior | Tested By / Date | Status |
|---|---|---|:---:|:---:|
| **MAN-05** | User A creates a room; User B opens the same room code in a second window | Both users see connection status badge "Connected"; active participants counter updates to 2. | | [ ] PENDING |
| **MAN-06** | User A types in `index.js`; User B observes the editor | Characters appear in real time (< 50ms latency) without cursor jump or character duplication. | | [ ] PENDING |
| **MAN-07** | User A moves cursor and selects text | User B sees User A's colored cursor tag and text selection highlight in the editor margin/text. | | [ ] PENDING |
| **MAN-08** | Both users type simultaneously on different lines | Changes merge conflict-free (Yjs CRDT) with zero lost keystrokes. | | [ ] PENDING |
| **MAN-09** | User A sends a message in the room chat drawer | User B receives the chat message with User A's name, timestamp, and correct message text immediately. | | [ ] PENDING |
| **MAN-10** | User A closes the tab; reopens within 5 seconds | User B sees presence temporarily decrease; upon reconnection, User A rehydrates the latest editor state. | | [ ] PENDING |

---

## 3. Standalone Compiler & Guest Access Checklist (Phase 7)

| Check ID | Verification Action | Expected Behavior | Tested By / Date | Status |
|---|---|---|:---:|:---:|
| **MAN-11** | Open `/compiler` in an Incognito window without logging in | Guest compiler workspace renders; "Guest Mode" indicator visible; language dropdown enabled. | | [ ] PENDING |
| **MAN-12** | In Guest mode, select Python 3.12, type `print("Hello from Guest")`, click Run | Code runs via Judge0; stdout displays `Hello from Guest`; execution time and memory are populated. | | [ ] PENDING |
| **MAN-13** | Log in as registered user, open `/compiler`, execute JavaScript `console.log(1+1)` | Code runs; output displays `2`; dashboard at `/dashboard` updates user's compiler run count. | | [ ] PENDING |
| **MAN-14** | Try clicking `/projects` while unauthenticated | App smoothly redirects to `/login?redirect=%2Fprojects`; after login, user lands on `/projects`. | | [ ] PENDING |

---

## 4. Project Workspace & Autosave Checklist (Phase 10)

| Check ID | Verification Action | Expected Behavior | Tested By / Date | Status |
|---|---|---|:---:|:---:|
| **MAN-15** | On `/projects`, click "+ New Project", enter "Test Project", select C++ | Project creates and immediately opens in Monaco editor with a starter `main.cpp` file. | | [ ] PENDING |
| **MAN-16** | Edit code in `main.cpp`; observe save badge | Badge changes from "Saved" to "Unsaved"; after 1.5s idle (autosave delay), badge switches back to "Saved". | | [ ] PENDING |
| **MAN-17** | In the file tree, right-click/click "+" to create new folder `src` and file `helper.cpp` | Folder and nested file appear in tree sorted correctly; files can be opened into separate tabs. | | [ ] PENDING |
| **MAN-18** | In `/projects`, click 3-dots menu on a project card, select "Rename" | Prompt appears; entering a new name updates the card title and persists upon page refresh. | | [ ] PENDING |
| **MAN-19** | Click "Download Project ZIP" | Browser downloads a `.zip` archive containing the exact project folder structure and files. | | [ ] PENDING |
