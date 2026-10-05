/* Emscripten passes the entire HEAPU32 to setBindGroup, even for a handful of
 * dynamic offsets. Firefox refuses views >= 2 GiB. Copy only those offsets in
 * that case; subarray alone would still retain the oversized backing buffer.
 * This guard does not fix or conceal growing WASM allocations. */
(function (root) {
  'use strict';
  var warned = false;
  ['GPURenderPassEncoder', 'GPUComputePassEncoder', 'GPURenderBundleEncoder'].forEach(function (name) {
    var proto = root[name] && root[name].prototype;
    if (!proto || typeof proto.setBindGroup !== 'function' || proto.__pnBoundOffsets) return;
    var original = proto.setBindGroup;
    proto.setBindGroup = function (index, group, offsets, start, count) {
      if (offsets && offsets.byteLength >= 0x80000000 && typeof offsets.slice === 'function') {
        // Keep invalid ranges on the native validation path rather than silently
        // truncating them. The Emscripten bridge supplies integer start/count.
        if (Number.isInteger(start) && Number.isInteger(count) && start >= 0 && count >= 0 && start + count <= offsets.length) {
          if (!warned) {
            warned = true;
            console.warn('[webgpu-memory] WASM view reached 2 GiB; copying bounded bind-group offsets. Investigate growing allocations.');
          }
          return original.call(this, index, group, offsets.slice(start, start + count), 0, count);
        }
      }
      return original.apply(this, arguments);
    };
    Object.defineProperty(proto, '__pnBoundOffsets', { value: true });
  });
})(globalThis);
