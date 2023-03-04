export class SMTPError extends Error {}

export class SMTPDisconnectedError extends SMTPError {}

export class SMTPNotSupportedError extends SMTPError {}

export class SMTPResponseException extends SMTPError {}
