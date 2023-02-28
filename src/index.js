"use strict";

const util = require("util");
const net = require("net");
const tls = require("tls");
const debug = require("debug")("promise-smtp");
const { SMTPError, SMTPServerDisconnected } = require("./error");

class SMTP {
  constructor(host, port, options = {}, localName = "localhost") {
    this.socket = null;
    this.ext = {};
    this.auth = [];

    this.host = host;
    this.port = port;
    this.tls = options.tls || false;

    this.localName = localName;
    this.didHello = false;
  }

  connect(options) {
    const selected = this.tls ? tls.connect : net.connect;
    this.socket = selected({ port: this.port, host: this.host, ...options });

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
    this.socket.destroy();
    this.socket = null;
    debug("close");
  }

  cmd(expectCode, format, ...args) {
    if (!this.socket) {
      throw new SMTPServerDisconnected("please run connect() first");
    }
    const line = util.format(`${format}\r\n`, ...args);

    return new Promise((resolve, reject) => {
      debug("> " + line);
      this.socket.write(line, "utf-8", () => {
        this.socket.once("data", (data) => {
          resolve(this._parseCodeLine(data.toString(), expectCode));
        });
      });
    });
  }

  async verify(addr) {
    // ehlo or ehlo first
    await this.hello();

    return this.cmd(250, "VRFY %s", addr);
  }

  async noop() {
    // ehlo or ehlo first
    await this.hello();

    return this.cmd(250, "NOOP");
  }

  async hello(name) {
    if (!this.didHello) {
      this.didHello = true;
      let resp = await this.ehlo(name);
      if (!(200 <= resp.code && resp.code < 300)) {
        resp = await this.helo(name);
        if (!(200 <= resp.code && resp.code < 300)) {
          throw new SMTPError("smtp hello error: " + resp);
        }
      }
    }
  }

  async helo(name) {
    return this.cmd(220, "HELO %s", name || this.localName);
  }

  async ehlo(name) {
    const { code, message } = await this.cmd(
      250,
      "EHLO %s",
      name || this.localName
    );
    const ext = {};
    const extList = message.split("\n");
    if (extList.length > 1) {
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
    }

    return { code, message };
  }

  async startTLS(tlsOptions) {
    // ehlo or ehlo first
    await this.hello();

    const { code, message } = await this.cmd(220, "STARTTLS");

    this.tls = true;
    await this.connect();

    return this.ehlo();
  }

  async login(user, password) {}

  async sendMail(from, to, msg) {}

  // Quit sends QUIT command and closes the connection to the server.
  async quit() {
    // ehlo or ehlo first
    await this.hello();

    return this.cmd(221, "QUIT");
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

module.exports = SMTP;
