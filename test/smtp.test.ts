import * as net from "net";
import SMTP from "../src/index";
import { SMTPError } from "../src/error";

type IServer = net.Server & { start: Function; stop: Function };

const PORT = 1025;
const createTestServer = (port: number) => {
  let server = net.createServer() as IServer;

  server.start = () => {
    return new Promise((resolve) => server.listen(port, () => resolve(null)));
  };
  server.stop = () => {
    return new Promise((resolve) => server.close(resolve));
  };

  return server;
};

describe("connect", () => {
  let server: IServer;
  let client: SMTP;

  beforeEach(() => {
    client = new SMTP("127.0.0.1", PORT);
  });

  afterEach(async () => {
    client.close();
    await server.stop();
  });

  it("should connect to the SMTP server", async () => {
    server = createTestServer(PORT);
    server.on("connection", (sock) => {
      sock.write("220 mx.test.com ESMTP\r\n");
    });
    await server.start();

    const result = await client.connect();

    expect(result.code).toBe(220);
    expect(result.message).toBe("mx.test.com ESMTP");
  });

  it("should throw when not 220", async () => {
    server = createTestServer(PORT);
    server.on("connection", (sock) => {
      sock.write("300 mx.test.com ESMTP\r\n");
    });
    await server.start();

    await expect(client.connect()).rejects.toThrowError(
      new SMTPError("unexpected code: 300")
    );
  });
});
