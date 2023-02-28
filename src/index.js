const util = require("util");
const net = require("net");
const debug = require("debug")("promise-smtp");
const { SMTPDisconnected } = require("./error");

class Client {

  constructor(host, port, localName) {
    this.socket = null;
    this.ext = {};

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

  cmd(expectCode, format, ...args) {
    if (!this.socket) {
      throw new SMTPDisconnected("please run connect() first");
    }
    const line = util.format(`${format}\r\n`, ...args);
    return new Promise((resolve, reject) => {
      debug('write: ' + line)
      this.socket.write(line, "utf-8", () => {
        this.socket.once("data", (data) => {
          resolve(this._parseCodeLine(data.toString(), expectCode));
        });
      });
    });
  }

  noop() {
    return new Promise((resolve, reject) => {
      this.cmd(250, "NOOP").then(resolve).catch(reject);
    });
  }

  helo(name) {
    return new Promise((resolve, reject) => {
      this.cmd(220, "HELO %s", name || this.localName)
        .then(resolve)
        .catch(reject);
    });
  }

  ehlo(name) {
    return new Promise((resolve, reject) => {
      this.cmd(250, "EHLO %s", name || this.localName)
        .then(resolve)
        .catch(reject);
    });
  }

  _parseCodeLine(reply, expectCode) {
    const lines = reply.split("\r\n");
    let code;
    const resp = [];
    for (const line of lines) {
      resp.push(line.substring(4).trim());
      code = parseInt(line.substring(0, 3), 10);
      if (line.substring(3, 4) != "-") {
        break;
      }
    }

    return { code, message: resp.join('\n') };
  }
}

module.exports = Client;
