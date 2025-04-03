import { Cbor, CborArray, CborBytes, CborMap, CborNegInt, CborObj, CborTag, CborText, CborUInt } from "@harmoniclabs/cbor";
import { toHex } from "@harmoniclabs/uint8array-utils";
import { createWriteStream } from "fs";
import { mkdir, readFile, writeFile } from "fs/promises"
import { JsonStreamStringify } from 'json-stream-stringify';
import { Worker } from "worker_threads";

void async function main() {

    await mkdir("./json", { recursive: true });

    const a = new Worker("./src/worker.js", { workerData: { fileName: "69638382.5da6ba37a4a07df015c4ea92c880e3600d7f098b97e73816f8df04bbb5fad3b7" } });
    const b = new Worker("./src/worker.js", { workerData: { fileName: "70070379.d6fe6439aed8bddc10eec22c1575bf0648e4a76125387d9e985e9a3f8342870d" } });
    const c = new Worker("./src/worker.js", { workerData: { fileName: "70502395.fcb6c0dfb6f921eb6001bf3e0ba750287c2a4b816d2131e2bf45083667216242" } });

    await Promise.all([
        new Promise<void>(res => a.once("message", res)),
        new Promise<void>(res => b.once("message", res)),
        new Promise<void>(res => c.once("message", res))
    ]);
    console.log("done");
}()

async function toJsonFile( fileName: string ): Promise<void>
{
    console.log("reading", fileName);
    const writeStream = createWriteStream(`./json/${fileName}.json`);
    const jsonStream = new JsonStreamStringify(
        Cbor.parse(
            await readFile(`./snapshots/${fileName}.cbor`)
            .then( buf => { console.log("loaded"); return buf; } )
        ).toRawObj(),
        (k: any, v: any) => {
            if( v instanceof Uint8Array ) return toHex(v);
            if( Buffer.isBuffer(v) ) return v.toString("hex");
            if( typeof v === "bigint" ) return v.toString();
            if( k === "options" ) return undefined;
            return v;
        },
        1
    );
    jsonStream.pipe(writeStream);
    jsonStream.on("end", () => console.log("done"));
}

function jsonifyCborObj( cbor: CborObj ): any
{
    if( cbor instanceof CborUInt ) return cbor.num.toString();
    if( cbor instanceof CborNegInt ) return cbor.num.toString();
    if( cbor instanceof CborText ) return cbor.text;
    if( cbor instanceof CborBytes ) return "0x" + toHex(cbor.bytes);
    if( cbor instanceof CborTag ) return { tag: Number( cbor.tag ), value: jsonifyCborObj(cbor.data) };
    if( cbor instanceof CborArray ) return cbor.array.map( jsonifyCborObj );
    if( cbor instanceof CborMap ) {
        const res = {};
        for( const { k: _k, v } of cbor.map ) {
            let k = jsonifyCborObj(_k);
            if( typeof k !== "string" ) k = JSON.stringify(k);
            (res as any)[k] = jsonifyCborObj(v);
        }
        return res;
    }

    return cbor.simple;
}