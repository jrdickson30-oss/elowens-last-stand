// Handle touch taps directly while allowing skill rails to scroll.
export function bindTouchAction(button:HTMLButtonElement,action:()=>void){
  const starts=new Map<number,{x:number;y:number}>();
  button.onpointerdown=e=>{if(e.pointerType==='touch'||e.pointerType==='pen'){e.preventDefault();starts.set(e.pointerId,{x:e.clientX,y:e.clientY});button.setPointerCapture(e.pointerId)}};
  button.onpointerup=e=>{const start=starts.get(e.pointerId);starts.delete(e.pointerId);if(start&&Math.hypot(e.clientX-start.x,e.clientY-start.y)<10)action()};
  button.onpointercancel=button.onlostpointercapture=e=>{starts.delete(e.pointerId)};
  button.onclick=e=>{const type=(e as PointerEvent).pointerType;if(type!=='touch'&&type!=='pen')action()};
}

type Held={key:string;button:HTMLButtonElement};
export class TouchControls {
  private held=new Map<number,Held>();
  private root:HTMLDivElement;
  private media=window.matchMedia('(pointer: coarse), (max-width: 800px)');
  private enabled=false;
  constructor(private touch:Set<string>,private pending:Set<string>){
    this.root=document.createElement('div');this.root.className='touch';
    this.root.innerHTML=`<div class="touch-pad" aria-label="Movement"><button data-key="W" class="touch-jump" aria-label="Jump">↑<span>Jump</span></button><button data-key="A" aria-label="Move left">◀</button><button data-key="S" aria-label="Crouch">↓<span>Crouch</span></button><button data-key="D" aria-label="Move right">▶</button></div><div class="touch-actions"><button data-key="L" class="touch-block" aria-label="Block">▣<span>Block</span></button><button data-key="J" class="touch-sword" aria-label="Sword attack">⚔<span>Sword</span></button></div><button class="touch-pause" aria-label="Pause game">Ⅱ</button>`;
    document.querySelector('.game-shell')!.append(this.root);
    const layout=()=>{document.body.classList.toggle('touch-layout',this.media.matches);if(!this.media.matches)this.clear()};layout();this.media.addEventListener('change',layout);
    for(const button of Array.from(this.root.querySelectorAll<HTMLButtonElement>('[data-key]'))){
      button.onpointerdown=e=>{if(!this.enabled)return;e.preventDefault();button.setPointerCapture(e.pointerId);this.hold(e.pointerId,button)};
      button.onpointermove=e=>{if(!button.hasPointerCapture(e.pointerId)||!button.closest('.touch-pad'))return;
        const target=document.elementFromPoint(e.clientX,e.clientY)?.closest<HTMLButtonElement>('.touch-pad button');
        if(target&&this.root.contains(target))this.hold(e.pointerId,target);else this.release(e.pointerId);
      };
      button.onpointerup=button.onpointercancel=button.onlostpointercapture=e=>this.release(e.pointerId);
    }
    bindTouchAction(this.root.querySelector<HTMLButtonElement>('.touch-pause')!,()=>{if(this.enabled)this.pending.add('ESC')});
    window.addEventListener('blur',()=>this.clear());document.addEventListener('visibilitychange',()=>{if(document.hidden)this.clear()});
  }
  private hold(id:number,button:HTMLButtonElement){
    if(this.held.get(id)?.button===button)return;
    this.release(id);const key=button.dataset.key!;if(key==='J'&&!this.touch.has(key))this.pending.add('J');this.held.set(id,{key,button});this.touch.add(key);button.classList.add('pressed');
  }
  private release(id:number){
    const held=this.held.get(id);if(!held)return;this.held.delete(id);
    if(![...this.held.values()].some(h=>h.key===held.key))this.touch.delete(held.key);
    if(![...this.held.values()].some(h=>h.button===held.button))held.button.classList.remove('pressed');
  }
  clear(){for(const id of [...this.held.keys()])this.release(id)}
  update(phase:string,paused:boolean){
    this.enabled=phase==='play'&&!paused;
    document.body.classList.toggle('touch-playing',this.enabled);
    this.root.hidden=!this.enabled;
    if(!this.enabled)this.clear();
  }
}

