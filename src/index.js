const util = require("util");
const net = require("net");
const debug = require("debug")("promise-smtp");
const { SMTPError, SMTPServerDisconnected } = require("./error");

class Client {
  constructor(host, port, localName = "localhost") {
    this.socket = null;
    this.ext = {};
    this.auth = [];

    this.host = host;
    this.port = port;

    this.localName = localName;
    this.didHello = false;
  }

  connect(options) {
    this.socket = net.connect({ port: this.port, host: this.host, ...options });

    return new Promise((resolve, reject) => {
      this.socket.on("connect", () => {
        this.socket.once("data", (data) => {
          debug("connect success: " + data.toString());
          resolve(this._parseCodeLine(data.toString(), 220));
        });
      });

      this.socket.on("timeout", () => {
        this.socket.emit("error", new SMTPError("timeout"));
      });

      this.socket.on("error", (err) => {
        debug("connect error: ", err);
        reject(err);
      });
    });
  }

  close() {
    if (!this.socket) {
      throw new SMTPServerDisconnected("please run connect() first");
    }
    this.socket.end();
    this.socket.destroy();
    this.socket = null;
  }

  cmd(expectCode, format, ...args) {
    if (!this.socket) {
      throw new SMTPServerDisconnected("please run connect() first");
    }
    const line = util.format(`${format}\r\n`, ...args);
    return new Promise((resolve, reject) => {
      debug("write: " + line);
      this.socket.write(line, "utf-8", () => {
        this.socket.once("data", (data) => {
          resolve(this._parseCodeLine(data.toString(), expectCode));
        });
      });
    });
  }

  verify(addr) {
    return new Promise((resolve, reject) => {
      this.cmd(250, "VRFY %s", addr).then(resolve).catch(reject);
    });
  }

  noop() {
    return new Promise((resolve, reject) => {
      this.cmd(250, "NOOP").then(resolve).catch(reject);
    });
  }

  hello(name) {
    return new Promise((resolve, reject) => {
      if (!this.didHello) {
        this.didHello = true;
        this.ehlo(name).then((resp) => {
          if (!(200 <= resp.code && resp.code < 300)) {
            this.helo(name).then((resp2) => {
              console.log(resp2.code);
              if (!(200 <= resp2.code && resp2.code < 300)) {
                reject(new Error("smtp helo error code: " + resp2.code));
              }
              resolve();
            });
          }
          resolve();
        });
      }
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
        .then((data) => {
          const ext = {};
          const extList = data.message.split("\n");
          if (extList.length > 1) {
            extList.shift(); // remove first line
            for (const line of extList) {
              const [k, ...v] = line.split(" ");
              ext[k] = v.join(" ");
            }
          }
          if (this.ext["AUTH"]) {
            this.auth = this.ext["AUTH"].split(" ");
          }
          this.ext = ext;
          resolve(data);
        })
        .catch(reject);
    });
  }

  login(user, password) {}

  sendMail(from, to, msg) {}

  quit() {
    return new Promise((resolve, reject) => {
      this.cmd(221, "QUIT").then(resolve).catch(reject);
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

    return { code, message: resp.join("\n") };
  }
}

module.exports = Client;
