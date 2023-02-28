const Client = require("../src/index");

const GMAIL_SMTP = "alt2.gmail-smtp-in.l.google.com";
const SMTP_PORT = 25;

async function main() {
  const client = new Client(GMAIL_SMTP, SMTP_PORT);
  await client.connect();

  console.log(await client.ehlo());
  console.log(await client.quit());

  client.close();
}

main();
