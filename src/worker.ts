import { Cbor, CborArray, CborBytes, CborMap, CborNegInt, CborObj, CborTag, CborText, CborUInt } from "@harmoniclabs/cbor";
import { toHex } from "@harmoniclabs/uint8array-utils";
import { JsonStreamStringify } from "json-stream-stringify";
import { createWriteStream } from "node:fs";
import { readFile } from "node:fs/promises";
import { parentPort, workerData } from "node:worker_threads";

const fileName = workerData.fileName;
const writeStream = createWriteStream(`./json/${fileName}.json`);
const jsonStream = new JsonStreamStringify(
    jsonifyCborObj(await ( async ()=>{
        const obj = Cbor.parse(
            await readFile(`./snapshots/${fileName}.cbor`)
        );
        console.log("loaded", fileName);
        return obj;
    })()),
    (k: any, v: any) => {
        if( v instanceof Uint8Array ) return toHex(v);
        if( Buffer.isBuffer(v) ) return v.toString("hex");
        if( typeof v === "bigint" ) return v.toString();
        if( k === "options" ) return undefined;
        return v;
    }
);
jsonStream.pipe(writeStream);
jsonStream.on("end", () => {
    console.log("done", fileName);
    parentPort?.postMessage({ done: true })
});

function jsonifyCborObj( cbor: CborObj ): any
{
    if( cbor instanceof CborUInt ) return cbor.num.toString();
    if( cbor instanceof CborNegInt ) return cbor.num.toString();
    if( cbor instanceof CborText ) return cbor.text;
    if( cbor instanceof CborBytes ) return toHex(cbor.bytes);
    if( cbor instanceof CborTag ) return { tag: Number( cbor.tag ), data: jsonifyCborObj(cbor.data) };
    if( cbor instanceof CborArray ) return cbor.array.map( jsonifyCborObj );
    if( cbor instanceof CborMap ) {
        const res = {};
        for( const { k: _k, v } of cbor.map ) {

            let k: any = undefined;
            if( looksLikeUtxoRef( _k ) )
            {
                k = `${toHex((_k as any).array[0].bytes)}#${(_k as any).array[1].num}`;
            }
            else k = jsonifyCborObj(_k);

            if( typeof k !== "string" ) k = JSON.stringify(k);
            (res as any)[k] = jsonifyCborObj(v);
        }
        return res;
    }

    return cbor.simple ?? null;
}

function looksLikeUtxoRef( cbor: CborObj ): cbor is CborArray
{
    return (
        cbor instanceof CborArray &&
        cbor.array.length === 2 &&
        cbor.array[0] instanceof CborBytes &&
        cbor.array[1] instanceof CborUInt &&
        cbor.array[0].bytes.length === 32
    );
} 