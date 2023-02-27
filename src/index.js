const util = require("util");
const net = require("net");
const debug = require("debug")("client");
const { SMTPDisconnected } = require('./error')

class Client {

  constructor(host, port, localName) {
    this.socket = null;

    this.host = host;
    this.port = port;
    this.localName = localName;
  }

  connect(options) {
    this.socket = net.connect(this.port, this.host, options);

    return new Promise((resolve, reject) => {
      this.socket.on("connect", () => {
        this.socket.once("data", (data) => {
          debug("connect success: " + data.toString());
          resolve();
        });
      });

      this.socket.on("error", (err) => {
        debug("connect error: ", err);
        reject(err);
      });
    });
  }

  close() {
    if (!this.socket) {
      throw new SMTPDisconnected("please run connect() first");
    }
    this.socket.end();
    this.socket.destroy();
    this.socket = null;
  }

  cmd(format, ...args) {
    if (!this.socket) {
      throw new SMTPDisconnected("please run connect() first");
    }
    const msg = util.format(`${format}\r\n`, ...args);

    return new Promise((resolve, reject) => {
      this.socket.write(msg, "utf-8", () => {
        this.socket.once("data", (data) => {
          resolve(data.toString());
        });
      });
    });
  }

  noop() {
    return new Promise((resolve, reject) => {
      this.cmd("NOOP").then(resolve).catch(reject);
    });
  }

  helo(name) {
    return new Promise((resolve, reject) => {
      this.cmd("HELO %s", name || this.localName)
        .then(resolve)
        .catch(reject);
    });
  }

  ehlo(name) {
    return new Promise((resolve, reject) => {
      this.cmd("EHLO %s", name || this.localName)
        .then(resolve)
        .catch(reject);
    });
  }
}

module.exports = Client;
