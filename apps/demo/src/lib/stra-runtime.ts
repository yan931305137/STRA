/**
 * STRA Demo - 产品展示运行时
 *
 * 简化版 STRA 初始化，专为产品展示设计。
 * 真实调用 @stra/core API，但预置展示用的语义树结构。
 */

import { RuntimeController } from '@stra/core';
import { HTMLRenderer } from '@stra/renderer-html';
import type { RuntimeControllerLike } from '@stra/types';

let _runtime: RuntimeController | null = null;

/** 获取或创建 STRA 运行时实例 */
export function getRuntime(): RuntimeController {
  if (_runtime) return _runtime;

  const rt = new RuntimeController();
  rt.setRenderer(new HTMLRenderer());
  _runtime = rt;
  return _runtime;
}

/** 销毁运行时（热更新时用） */
export function destroyRuntime(): void {
  if (_runtime) {
    _runtime.unmount();
    _runtime = null;
  }
}
