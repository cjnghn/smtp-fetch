"use strict";

const net = require("net");
const SMTP = require("../src");

const DUMMY_PORT = 1025;

const createTestServer = (port) => {
  let server = net.createServer();

  server.start = () => new Promise((r) => server.listen(port, r));
  server.stop = () => new Promise((r) => server.close(r));

  return server;
};

describe("connect", () => {
  let c, s;

  afterEach(async () => {
    c.close();
    await s.stop();
  });

  it("sholud connect to the SMTP server", async () => {
    s = createTestServer(DUMMY_PORT);
    s.on("connection", (sock) => {
      sock.write("220 mx.test.com ESMTP\r\n");
    });
    await s.start();

    c = new SMTP("127.0.0.1", DUMMY_PORT);
    const result = await c.connect();

    expect(result.code).toBe(220);
    expect(result.message).toBe("mx.test.com ESMTP");
  });
});
