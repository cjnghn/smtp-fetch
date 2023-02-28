"use strict";

const net = require("net");
const SMTP = require("../src");
const { SMTPError } = require("../src/error");

const DUMMY_PORT = 1025;

const createTestServer = (port) => {
  let server = net.createServer();
  server.start = () => new Promise((r) => server.listen(port, r));
  server.stop = () => new Promise((r) => server.close(r));

  return server;
};

describe("connect", () => {
  let c;
  let s;

  beforeEach(() => {
    c = new SMTP("127.0.0.1", DUMMY_PORT);
  });

  afterEach(async () => {
    c.close();
    await s.stop();
  });

  it("should connect to the SMTP server", async () => {
    s = createTestServer(DUMMY_PORT);
    s.on("connection", (sock) => {
      sock.write("220 mx.test.com ESMTP\r\n");
    });
    await s.start();

    const result = await c.connect();

    expect(result.code).toBe(220);
    expect(result.message).toBe("mx.test.com ESMTP");
  });

  it("should throw when not 220", async () => {
    s = createTestServer(DUMMY_PORT);
    s.on("connection", (sock) => {
      sock.write("300 mx.test.com ESMTP\r\n");
    });
    await s.start();

    await expect(c.connect()).rejects.toThrowError(
      new SMTPError("unexpected code: 300")
    );
  });
});
