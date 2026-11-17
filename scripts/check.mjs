import assert from 'node:assert/strict';
import {topics} from '../src/data/curriculum.js';
import {interviews} from '../src/data/interviews.js';
assert.equal(new Set(topics.map(t=>t.id)).size,topics.length);
for(const topic of topics){
 assert.equal(topic.questions.length,4,topic.id);
 assert.ok(topic.steps.length>=3,topic.id);
 for(const question of topic.questions){
  assert.equal(question.options.length,4,question.id);
  assert.equal(new Set(question.options).size,4,question.id);
  assert.ok(Number.isInteger(question.answer)&&question.answer>=0&&question.answer<4,question.id);
  assert.ok(question.explanation.length>5,question.id);
 }
}
assert.equal(new Set(interviews.map(q=>q.id)).size,interviews.length);
for(const question of interviews){assert.ok(['recalled','inferred'].includes(question.origin));assert.ok(question.outline.length>=3);assert.ok(question.followUp);}
// Enumerate the teaching example instead of relying on a memorized answer.
const outcomes=[];for(let a=1;a<=6;a++)for(let b=1;b<=6;b++)if(a+b>=9)outcomes.push([a,b]);
assert.equal(outcomes.length,10);assert.equal(outcomes.filter(([a,b])=>a===6||b===6).length,7);
console.log(`Verified ${topics.length} cards, ${topics.length*4} questions, ${interviews.length} interview prompts.`);
