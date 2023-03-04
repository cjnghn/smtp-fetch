import util from "util";
import net from "net";
import tls from "tls";
import debug from "debug";
import { SMTPError, SMTPServerDisconnected } from "./error";

const log = debug("smtp");

export type ISocket = net.Socket | tls.TLSSocket;
export type IExtension = { [key: string]: string };

export type IResponse = { code: number; message: string };

export default class SMTP {
  // A Client represents a client connection to an SMTP server.

  private socket: ISocket | undefined;
  private ext: IExtension | undefined = {};
  private auth: string[] | undefined = [];

  private didHello: boolean = false;

  constructor(
    private readonly host: string,
    private readonly port: number,
    private tls: boolean = false,
    private localName = "localhost"
  ) {}

  public connect(options = {}): Promise<IResponse> {
    const select = (this.tls ? tls.connect : net.connect) as Function;
    this.socket = select({ port: this.port, host: this.host, ...options });

    return new Promise((resolve, reject) => {
      this.socket.on("connect", () => {
        this.socket.once("data", (data) => {
          try {
            log("connect: " + data.toString());
            resolve(this.parseCodeLine(data.toString(), 220));
          } catch (err) {
            log("connect error: " + err.message);
            reject(err);
          }
        });
      });

      this.socket.on("timeout", () => {
        log("timeout error");
        this.socket.emit("error", new SMTPError("timeout"));
      });

      this.socket.on("error", (err) => {
        log("connect error: " + err);
        reject(err);
      });
    });
  }

  // Close closes the connection.
  public close() {
    if (!this.socket) {
      throw new SMTPServerDisconnected("please run connect() first");
    }
    this.socket.destroy();
    this.socket = null;
  }

  public cmd(
    expectCode: number,
    format: string,
    ...args: any[]
  ): Promise<IResponse> {
    if (!this.socket) {
      throw new SMTPServerDisconnected("please run connect() first");
    }
    const line = util.format(`${format}\r\n`, ...args);

    return new Promise((resolve) => {
      log(">> " + line);
      this.socket.write(line, "utf-8", () => {
        this.socket.once("data", (data) => {
          resolve(this.parseCodeLine(data.toString(), expectCode));
        });
      });
    });
  }

  public async verify(addr: string): Promise<IResponse> {
    // ehlo or ehlo first
    await this.hello();

    return this.cmd(250, "VRFY %s", addr);
  }

  public async noop(): Promise<IResponse> {
    // ehlo or ehlo first
    await this.hello();

    return this.cmd(250, "NOOP");
  }

  // hello runs a hello exchange if needed.
  public async hello(name: string = "hi") {
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

  // helo sends the HELO greeting to the server. It should be used only when the
  // server does not support ehlo.
  public async helo(name: string = "hi"): Promise<IResponse> {
    return this.cmd(220, "HELO %s", name || this.localName);
  }

  // ehlo sends the EHLO (extended hello) greeting to the server. It
  // should be the preferred greeting for servers that support it.
  public async ehlo(name: string = "hi"): Promise<IResponse> {
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

  // StartTLS sends the STARTTLS command and encrypts all further communication.
  // Only servers that advertise the STARTTLS extension support this function.
  public async startTLS(tlsOptions = {}): Promise<IResponse> {
    // ehlo or ehlo first
    await this.hello();

    const { code, message } = await this.cmd(220, "STARTTLS");

    this.tls = true;
    await this.connect();

    return this.ehlo();
  }

  // public async login(user: string, password: string): Promise<IResponse> {}

  // public async sendMail(
  //   from: string,
  //   to: string,
  //   msg: string
  // ): Promise<IResponse> {}

  // Quit sends QUIT command and closes the connection to the server.
  public async quit(): Promise<IResponse> {
    // ehlo or ehlo first
    await this.hello();

    return this.cmd(221, "QUIT");
  }

  private parseCodeLine(reply: string, expectCode: number): IResponse {
    const lines = reply.split("\r\n");
    let code: number;
    const resp = [];
    for (const line of lines) {
      resp.push(line.substring(4).trim());
      code = parseInt(line.substring(0, 3), 10);
      if (line.substring(3, 4) != "-") {
        break;
      }
    }

    if (expectCode !== code) {
      throw new SMTPError("unexpected code: " + code);
    }

    return { code, message: resp.join("\n") };
  }
}
