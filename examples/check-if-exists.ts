import { Client } from "../src/index";

async function checkIfExists(email: string) {
  const client = new Client("mx2.naver.com", 25);

  try {
    await client.connect();
    await client.mail("");
    await client.rcpt(email);
    await client.quit();

    return true;
  } catch (err) {
    return false;
  } finally {
    client.close();
  }
}

async function wait(ms: number) {
  return new Promise((resolve) => setTimeout(() => resolve(null), ms));
}

async function main() {
  for (let i = 741; i < 999; i++) {
    const exist = await checkIfExists(`chotnt${i}@naver.com`);
    console.log(`chotnt${i}@naver.com ${exist ? "✅" : "🔥"}`);
    await wait(1000);
  }
}

main();
