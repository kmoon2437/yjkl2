const LineConverter = require('./LineConverter');
const Events = require('./Events');
const BPMConverter = require('./BPMConverter');

const LINE_0 = 0;
const LINE_1 = 1;
const LINE_2 = 2;

module.exports = class Converter{
    static convert(data,opts){
        opts = Object.assign({
            enableMsec:false
        },opts);
        
        data.info = data.info || {};
        data.files = data.files || {};
        data.config = data.config || {};

        // data는 json 파싱이 됐다고 가정
        let useAudioSync = opts.forceAudioSync ? true : !data.files.midi;
        let sync = data.config.syncOffset || 0;
        if(useAudioSync) sync += data.config.audioSyncOffset || 0;
        
        // bpm을 반영해 밀리초로 변환
        data.config.ticksPerBeat = data.config.ticksPerBeat || 120;
        let lines = LineConverter.convert(data);
        let bpmc = new BPMConverter(data.tempo,data.config.ticksPerBeat,sync);
        //console.log(bpmc);
        for(let i in lines){
            lines[i].showTime = bpmc.convertToMs(lines[i].showTime);
            if(lines[i].hideTime){
                //console.log('hideTime',lines[i].hideTime);
                lines[i].hideTime = bpmc.convertToMs(lines[i].hideTime);
                //console.log('hideTime2',lines[i].hideTime);
            }
            for(let j in lines[i].content){
                for(let k in lines[i].content[j].syllables){
                    lines[i].content[j].syllables[k].timing.currentBPM = bpmc.getBPM(lines[i].content[j].syllables[k].timing.start);
                    lines[i].content[j].syllables[k].timing.start = bpmc.convertToMs(lines[i].content[j].syllables[k].timing.start);
                    lines[i].content[j].syllables[k].timing.end = bpmc.convertToMs(lines[i].content[j].syllables[k].timing.end);
                    if(lines[i].content[j].syllables[k].timing.splitTimes){
                        lines[i].content[j].syllables[k].timing.splitTimes = lines[i].content[j].syllables[k].timing.splitTimes.map(a => bpmc.convertToMs(a));
                    }
                }
            }/*

            for(let j in lines[i].timings){
                lines[i].timings[j].currentBPM = bpmc.getBPM(lines[i].timings[j].start);
                lines[i].timings[j].start = bpmc.convertToMs(lines[i].timings[j].start);
                lines[i].timings[j].end = bpmc.convertToMs(lines[i].timings[j].end);
                if(lines[i].timings[j].splitTimes){
                    lines[i].timings[j].splitTimes = lines[i].timings[j].splitTimes.map(a => {
                        return bpmc.convertToMs(a);
                    });
                }
            }*/
        }
        
        // 줄 번호에 따라 분류
        let classifiedLines = {};
        lines.forEach(line => {
            if(!classifiedLines[line.lineCode]){
                classifiedLines[line.lineCode] = [];
            }
            classifiedLines[line.lineCode].push(line);
        });

        // 이벤트 형식으로 변환
        let events = new Events();
        for(let i in classifiedLines){
            classifiedLines[i].forEach((line,j) => {
                //console.log(line.sub,i,j,line.params,line.startCount);
                if(line.params.startCount){
                    let t = line.content[0].syllables[0].timing;
                    let beat = 60000/t.currentBPM;
                    let startTime = t.start;
                    let count = typeof line.params.startCount == 'number' ? Math.max(1,Math.min(4,line.params.startCount)) : 4;
                    for(let i = 0;i <= count;i++){
                        events.add(startTime-(beat*i),'countdown',{ val:i || null,lineCode:line.lineCode });
                    }
                }
                events.add(line.showTime,'renderlyrics',line);
                // 어차피 숨김 이벤트가 없어도
                // 다음에 같은 위치에 다른 가사가 오면
                // 렌더링할 때 그걸로 대체됨
                if(line.hideTime && line.showTime < line.hideTime){
                    events.add(line.hideTime,'hidelyrics',{ lineCode:line.lineCode });
                }else if(j == classifiedLines[i].length-1){
                    // 근데 이게 마지막이면 다음 가사가 없으므로
                    // 이 가사가 끝나는 즉시 가사를 숨김
                    let t = line.content[line.content.length-1];
                    t = t.syllables[t.syllables.length-1];
                    events.add(t.timing.end,'hidelyrics',{ lineCode:line.lineCode });
                }
            });
        }
        
        let keys = Object.keys(events.getAll());
        let firstEventTime = Math.min(...keys);
        firstEventTime = Math.max(firstEventTime-1500,0);
        let lastEventTime = Math.max(...keys);

        // 재생후 firsteventtime에 도달하지 않아도 10초가 되면 cleangui 실행
        // 참고로 cleangui는 제목 숨기기 이벤트
        events.add(Math.min(10000,firstEventTime),'cleangui',{},true);
        events.add(0,'hidelyrics',{},true);
        
        events.add(lastEventTime+150,'showinfo',{});
        events.add(lastEventTime+150+7500,'cleangui',{});

        if(data.files.mv){
            let time = data.files.mvTiming || 0;
            events.add(time,'playmv',{},true);
        }

        //console.log(JSON.stringify(events.getAll(),0,4)); process.exit();
        return {
            info:data.info,
            files:data.files,
            config:data.config,
            events:events.getAll(),
            lyricLines:lines
        };
    }
}