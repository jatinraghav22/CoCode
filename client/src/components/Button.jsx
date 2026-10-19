import React from "react";
import { Link } from "react-router-dom";
import "./Button.css";

/**
 * Reusable Button component supporting primary, secondary, outline, ghost, and glow variants.
 * Handles internal navigation via React Router `to`, external links via `href`, and standard button events.
 */
export default function Button({
  children,
  variant = "primary",
  size = "md",
  to,
  href,
  className = "",
  disabled = false,
  loading = false,
  type = "button",
  onClick,
  icon: Icon,
  iconRight: IconRight,
  ...rest
}) {
  const classes = [
    "btn",
    `btn-${variant}`,
    `btn-${size}`,
    disabled || loading ? "is-disabled" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const content = (
    <>
      {loading ? (
        <span className="btn-spinner" aria-hidden="true" />
      ) : Icon ? (
        <Icon size={size === "sm" ? 15 : size === "lg" ? 20 : 17} aria-hidden="true" />
      ) : null}
      <span>{children}</span>
      {IconRight && !loading && (
        <IconRight size={size === "sm" ? 15 : size === "lg" ? 20 : 17} aria-hidden="true" />
      )}
    </>
  );

  if (to && !disabled) {
    return (
      <Link to={to} className={classes} {...rest}>
        {content}
      </Link>
    );
  }

  if (href && !disabled) {
    return (
      <a href={href} className={classes} {...rest}>
        {content}
      </a>
    );
  }

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      onClick={onClick}
      {...rest}
    >
      {content}
    </button>
  );
}
