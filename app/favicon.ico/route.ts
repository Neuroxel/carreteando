// Tiny original pixel mark; binary ICO keeps browser favicon requests local.
export function GET() {
 const size=16, bytes=Buffer.alloc(22+40+size*size*4+size*4);
 bytes.writeUInt16LE(1,2);bytes.writeUInt16LE(1,4);bytes[6]=size;bytes[7]=size;
 bytes.writeUInt16LE(1,10);bytes.writeUInt16LE(32,12);bytes.writeUInt32LE(bytes.length-22,14);bytes.writeUInt32LE(22,18);
 bytes.writeUInt32LE(40,22);bytes.writeInt32LE(size,26);bytes.writeInt32LE(size*2,30);bytes.writeUInt16LE(1,34);bytes.writeUInt16LE(32,36);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){const mark=(x>=6&&x<=9)||(y>=6&&y<=9);const i=62+(y*size+x)*4;bytes[i]=mark?137:20;bytes[i+1]=mark?239:22;bytes[i+2]=mark?217:21;bytes[i+3]=255;}
 return new Response(bytes,{headers:{'Content-Type':'image/x-icon','Cache-Control':'public, max-age=86400'}});
}
