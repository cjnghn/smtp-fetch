const Client = require("../src/index");

const GMAIL_SMTP = "smtp.gmail.com";
const SMTP_PORT = 465;

async function main() {
  const client = new Client(GMAIL_SMTP, SMTP_PORT, { tls: true });

  await client.connect();
  await client.startTLS();

  await client.quit();

  client.close();
}

main();
