const Client = require("../src/index");

const GMAIL_SMTP = "smtp.google.com";
const SMTP_PORT = 465;

async function main() {
  const client = new Client(GMAIL_SMTP, SMTP_PORT);
  await client.connect({ timeout: 3000 });
  await client.hello();
  console.log(client.auth);
  await client.quit();
  client.close();
}

main();
