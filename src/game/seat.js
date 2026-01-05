export function nextIndexCircular(i, n, dir) {
 if (n <= 0) return 0;
 const raw = i + dir;
 if (raw < 0) return n - 1;
 if (raw >= n) return 0;
 return raw;
}

/**
* Move to the next alive seat (circular).
* - fromSeat: current seat number
* - dir: 1 (clockwise) or -1 (counter)
* - skipCount: how many extra alive players to skip (0 = normal next)
* - aliveList: array of alive seat numbers in sorted order, e.g. [0,2,4]
*/
export function nextAliveSeat(fromSeat, dir, skipCount = 0, aliveList = []) {
 if (!aliveList.length) return null;

 let idx = aliveList.indexOf(fromSeat);
 if (idx === -1) idx = 0;

 idx = nextIndexCircular(idx, aliveList.length, dir);

 for (let i = 0; i < skipCount; i++) {
   idx = nextIndexCircular(idx, aliveList.length, dir);
 }

 return aliveList[idx];
}
