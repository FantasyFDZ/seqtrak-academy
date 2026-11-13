// 发声的统一入口。role: backing（伴奏）/ guide（示范你该打的音）/ hit（你自己打出来的音）。
// 目前都由应用自带的合成器发声；以后可以在这里改成让 SEQTRAK 自己响。
import { audio } from './audio.js';

export const sound = {
  drum(trackId, ctxTime, vel = 1, role = 'backing') {
    audio.drum(trackId, ctxTime, role === 'guide' ? vel * 0.7 : vel, role === 'guide' ? 'guide' : 'drums');
  },

  note(midiNote, ctxTime, durSec, voice = 'keys', vel = 0.9, role = 'backing') {
    return audio.note(midiNote, ctxTime, durSec, { voice, vel: role === 'guide' ? vel * 0.7 : vel, bus: role === 'guide' ? 'guide' : 'synth' });
  },

  click(ctxTime, accent) {
    audio.click(ctxTime, accent);
  },
};
