/** Swipe is a shortcut for the two extreme SRS ratings, never a replacement for the four buttons. */
export type SwipeRating = 0 | 3;

/** Distance takes precedence; velocity needs enough deliberate horizontal travel. */
export function resolveFlashSwipe(offsetX:number,offsetY:number,velocityX:number):SwipeRating|null {
 if(!Number.isFinite(offsetX)||!Number.isFinite(offsetY)||!Number.isFinite(velocityX))return null;
 const dx=Math.abs(offsetX),dy=Math.abs(offsetY);
 if(dx<18||dx<dy*1.4)return null;
 if(dx>=96||(dx>=36&&Math.abs(velocityX)>=850))
  return offsetX<0?0:3;
 return null;
}
