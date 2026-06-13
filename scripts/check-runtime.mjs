const [major, minor] = process.versions.node.split('.').map(Number);
if (major !== 24 || minor < 14) {
  throw new Error(`Node.js 24.14.x is required; current runtime is ${process.versions.node}.`);
}
console.log(JSON.stringify({
  status: 'ok',
  node: process.versions.node,
  required: '24.14.x'
}, null, 2));

