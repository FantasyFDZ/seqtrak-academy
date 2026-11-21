// 全部场景，按出场顺序。
import { brandScene } from './brand.js';
import { gameScene } from './game.js';
import { mirrorScene } from './mirror.js';
import { theoryScene } from './theory.js';
import { birdScene } from './bird.js';
import { dropScene } from './drop.js';
import { keysScene } from './keys.js';
import { endScene } from './end.js';

export function buildScenes(engine) {
  engine.spots = engine.spots || {};
  return [brandScene(engine), gameScene(engine), mirrorScene(engine), theoryScene(engine), birdScene(engine), keysScene(engine), dropScene(engine), endScene(engine)];
}
