module.exports = class BPMConverter{
    constructor(bpmChanges,ticksPerBeat = 120,syncMs = 0){
        this.ticksPerBeat = ticksPerBeat;
        this.syncMs = syncMs;
        this.bpmChanges = [];
        let lastMs = 0;
        let lastTick = 0;
        let lastBPM = bpmChanges[0].bpm;
        for(let e of bpmChanges){
            let ms = lastMs + 60000/lastBPM*((e.changeAt - lastTick)/120);
            lastMs = ms;
            lastTick = e.changeAt;
            lastBPM = e.bpm;
            this.bpmChanges.push({
                bpm:e.bpm,ms,tick:e.changeAt
            });
        }
        //console.log(this);
    }

    convertToMs(tick){
        let g;
        for(let i = this.bpmChanges.length-1;i >= 0;i--){
            g = this.bpmChanges[i];
            if(g.tick < tick){
                return Math.round(g.ms + (60000/g.bpm)*((tick - g.tick)/this.ticksPerBeat)) + this.syncMs; // 싱크도 여기서 반영
            }
        }
    }

    getBPM(tick){
        let g;
        for(let i = this.bpmChanges.length-1;i >= 0;i--){
            g = this.bpmChanges[i];
            if(g.tick < tick) return g.bpm;
        }
    }
}