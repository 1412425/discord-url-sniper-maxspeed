//bu sniper ravi tarafından yapılmıştır
const tls = require("tls");
const WebSocket = require("ws");
const extractJsonFromString = require("extract-json-from-string")
const DISCORD_HOST = "canary.discord.com";
const DISCORD_PORT = 443;
const TLS_MIN_VERSION = "TLSv1.1";
const TLS_MAX_VERSION = "TLSv1.2";
const WS_LINK = "wss://gateway.discord.gg";
// burada 2 tane tkn giriceksin farklı sw ve id ler olabilir bu ttknnlere kurulu olucak sunucularda dahil
const SERVERS = [
  {
    TOKEN: "1.",
    SERVER_ID: "1. server id",
    CHANNEL_ID: "1. chanel id"
  },
  {
    TOKEN: "2.",
    SERVER_ID: "2. server id",
    CHANNEL_ID: "2. chanel id"
  },
];
const connectToServer = (serverConfig) => {
  const { TOKEN, SERVER_ID, CHANNEL_ID } = serverConfig;
  let tlsSock = null;
  let ws = null;
  const guilds = {};
  const stabil = () => {
    console.log(`Starting TLS connection for Server ID: ${SERVER_ID}`);
    tlsSock = tls.connect({
      host: DISCORD_HOST,
      port: DISCORD_PORT,
      minVersion: TLS_MIN_VERSION,
      maxVersion: TLS_MAX_VERSION,
      servername: DISCORD_HOST,
    });
    tlsSock.once("secureConnect", () => {
      console.log(`TLS connection established for Server ID: ${SERVER_ID}`);
      establishWSConnection(WS_LINK);
    });
    tlsSock.on("error", (error) => {
      console.error(`TLS Error for Server ID ${SERVER_ID}:`, error);
      process.exit();
    });
    tlsSock.on("end", () => {
      console.log(`TLS connection ended for Server ID: ${SERVER_ID}`);
      process.exit();
    });
  };
  tlsSock?.on("data", async (data) => {
    const ext = await extractJsonFromString(data.toString());
    if (!Array.isArray(ext)) {
      console.error(ext);
      return;
    }
    const find = ext.find((e) => e.code) || ext.find((e) => e.message && e.message.toLowerCase().includes("rate"));
    if (find) {
      const requestBody = JSON.stringify({
        content: `@everyone ${vanity}\n\`\`\`json\n${JSON.stringify(find, null, 2)}\`\`\``,
      });
      const contentLength = Buffer.byteLength(requestBody);
      const requestHeader = [
        `POST /api/v7/channels/${CHANNEL_ID}/messages HTTP/1.1`,
        `Host: canary.discord.com`,
        `Authorization: ${TOKEN}`,
        `Content-Type: application/json`,
        `Content-Length: ${contentLength}`
      ].join("\r\n");

      const request = requestHeader + "\r\n\r\n" + requestBody;
      tlsSock.write(request);
    }
  });
  const handleWSMessage = (msg) => {
    console.log(`Received WS message for Server ID ${SERVER_ID}:`);
    const { t, d, op } = msg;
    if (op === 7) {
      process.exit();
    }
    if (t === "GUILD_UPDATE") {
      const find = guilds[d.guild_id];
      if (find && find !== d.vanity_url_code) {
        const requestBody = JSON.stringify({ code: find });
        const requestHeader = [
          `PATCH /api/v7/guilds/${SERVER_ID}/vanity-url HTTP/1.1`,
          `Host: canary.discord.com`,
          `Authorization: ${TOKEN}`,
          `Content-Type: application/json`,
          `Content-Length: ${Buffer.byteLength(requestBody)}`,
        ].join("\r\n");
        const request = requestHeader + "\r\n\r\n" + requestBody;
        tlsSock.write(request);
        vanity = find;
      }
    } else if (t === "READY") {
      d.guilds.forEach(({ id, vanity_url_code }) => {
        if (vanity_url_code)
          guilds[id] = vanity_url_code;
      });
      const guildsList = Object.values(guilds).join(", ");
      console.log(`Guilds for Server ID ${SERVER_ID}:`, guildsList);
      sendWebhookMessage(`${guildsList}`);
    }
  };
  const establishWSConnection = (wsLink) => {
    ws = new WebSocket(wsLink);
    ws.once("open", () => {
      console.log(`WebSocket connection opened for Server ID: ${SERVER_ID}`);
      ws.send(JSON.stringify({
        op: 2,
        d: {
          token: TOKEN,
          intents: 513,
          properties: {
            os: "linux",
            browser: "firefox",
            device: "firefox",
          },
        },
      }));
      startHeartbeat();
    });
    ws.on("message", (event) => {
      handleWSMessage(JSON.parse(event.toString()));
    });
    ws.on("error", (error) => {
      console.error(`WebSocket Error for Server ID ${SERVER_ID}:`, error);
      process.exit();
    });
    ws.on("close", () => {
      console.log(`WebSocket connection closed for Server ID: ${SERVER_ID}`);
      process.exit();
    });
  };
  const startHeartbeat = () => {
    setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ op: 1, d: null }));
        console.log(`Heartbeat sent for Server ID: ${SERVER_ID}`);
      }
    }, 30000);
  };

  stabil();
};
SERVERS.forEach((serverConfig) => {
  connectToServer(serverConfig);
});