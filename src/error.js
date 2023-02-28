class SMTPError extends Error {}

class SMTPServerDisconnected extends SMTPError {}

module.exports = { SMTPError, SMTPServerDisconnected };
