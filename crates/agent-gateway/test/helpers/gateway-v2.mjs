// v2 线协议测试编解码器：用与被测代码同一份生成 schema + protobuf 运行时
// 编解码二进制帧，让 FakeWebSocket 以 v2 服务端的身份说话。
// 服务端帧用 protojson 形状（proto 字段名 + oneof 臂即普通字段）构造，
// bytes 字段传 base64 字符串。
export function createGatewayV2Codec(loader) {
  const pb = loader.loadModule("@bufbuild/protobuf");
  const v2 = loader.loadModule("src/lib/proto/gen/proto/v2/gateway_ws_pb.ts");

  const toBytes = (data) => {
    if (data instanceof Uint8Array) return data;
    if (data instanceof ArrayBuffer) return new Uint8Array(data);
    if (ArrayBuffer.isView(data)) {
      return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    }
    throw new Error("expected binary frame data");
  };

  // 编码为 ArrayBuffer（浏览器 binaryType="arraybuffer" 时 event.data 的形状）。
  const toArrayBuffer = (u8) => u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);

  function decodeClientFrame(data) {
    const frame = pb.fromBinary(v2.WebClientFrameSchema, toBytes(data));
    const json = pb.toJson(v2.WebClientFrameSchema, frame, { useProtoFieldName: true });
    return {
      requestId: frame.requestId ?? "",
      case: frame.payload?.case,
      json,
      frame,
    };
  }

  // init 为 protojson 形状，如 { request_id: "r1", status: { online: true } }。
  function encodeServerFrame(init) {
    const frame = pb.fromJson(v2.WebServerFrameSchema, init);
    return toArrayBuffer(pb.toBinary(v2.WebServerFrameSchema, frame));
  }

  function decodeTerminalClientFrame(data) {
    const frame = pb.fromBinary(v2.TerminalClientFrameSchema, toBytes(data));
    const json = pb.toJson(v2.TerminalClientFrameSchema, frame, { useProtoFieldName: true });
    return { case: frame.payload?.case, json, frame };
  }

  function encodeTerminalServerFrame(init) {
    const frame = pb.fromJson(v2.TerminalServerFrameSchema, init);
    return toArrayBuffer(pb.toBinary(v2.TerminalServerFrameSchema, frame));
  }

  // bytes 字段的 protojson 形式：字符串按 UTF-8、二进制原样、其余 JSON 序列化。
  const base64 = (value) => {
    if (value instanceof Uint8Array || Array.isArray(value)) {
      return Buffer.from(value).toString("base64");
    }
    return Buffer.from(typeof value === "string" ? value : JSON.stringify(value)).toString(
      "base64",
    );
  };

  return {
    pb,
    v2,
    decodeClientFrame,
    encodeServerFrame,
    decodeTerminalClientFrame,
    encodeTerminalServerFrame,
    base64,
  };
}
