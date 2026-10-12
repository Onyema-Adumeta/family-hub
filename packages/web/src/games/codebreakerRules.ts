export function feedback(secret:number[],guess:number[]){
 let exact=0;const a:number[]=[],b:number[]=[];
 for(let i=0;i<secret.length;i++){if(secret[i]===guess[i])exact++;else{a.push(secret[i]);b.push(guess[i]);}}
 let misplaced=0;
 for(const pin of b){const index=a.indexOf(pin);if(index>=0){misplaced++;a.splice(index,1);}}
 return {exact,misplaced};
}
export function createCode(length:number,repeats:boolean){
 const pins=[0,1,2,3,4,5];
 for(let i=pins.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[pins[i],pins[j]]=[pins[j],pins[i]];}
 return repeats?Array.from({length},()=>Math.floor(Math.random()*6)):pins.slice(0,length);
}
