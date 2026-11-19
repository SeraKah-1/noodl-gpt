import {replayReviews} from '../shared/engine';
import type {Pack,Question,ReviewCard,ReviewEvent} from '../shared/types';

export interface QueueEntry {
 packId:string; packTitle:string; question:Question; card?:ReviewCard;
}
export interface ReviewQueues {
 due:QueueEntry[]; newCards:QueueEntry[]; scheduled:QueueEntry[];
}
/** New questions are not overdue. SRS due dates exist only after a review event. */
export function buildReviewQueues(packs:Pack[],reviews:ReviewEvent[],now=Date.now()):ReviewQueues {
 const cards=new Map(replayReviews(reviews.filter(e=>!('deletedAt' in e))).map(c=>[c.id,c]));
 const result:ReviewQueues={due:[],newCards:[],scheduled:[]};
 for(const pack of packs) {
  if(pack.deletedAt)continue;
  for(const question of pack.questions){
   const card=cards.get(pack.id+':'+question.id);
   const entry:QueueEntry={packId:pack.id,packTitle:pack.title,question,...(card?{card}:{})};
   if(!card)result.newCards.push(entry);
   else if(Date.parse(card.nextReview)<=now)result.due.push(entry);
   else result.scheduled.push(entry);
  }
 }
 result.due.sort((a,b)=>(a.card?.nextReview??'').localeCompare(b.card?.nextReview??''));
 result.scheduled.sort((a,b)=>(a.card?.nextReview??'').localeCompare(b.card?.nextReview??''));
 return result;
}
