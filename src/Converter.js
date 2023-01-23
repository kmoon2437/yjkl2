const CommandConverter = require('./CommandConverter');
const Events = require('./Events');
const Parser = require('./Parser');
const BPMConverter = require('./BPMConverter');
const { cloneObject,classifyHeader } = require('./utilFunctions');

const LINE_0 = 0;
const LINE_1 = 1;
const LINE_2 = 2;

const defaultOptions = {
    headerOnly:false
};

module.exports = class Converter{
    static convert(data,opts){
        return this.convertParsed(Parser.parse(data),opts);
    }
    
    static convertParsed({ headers,commands },opts){
        opts = Object.assign({
            enableMsec:false
        },opts);
        let classifiedHeaders = classifyHeader(headers);

        let useMRSync = opts.forceMRSync ? true : !classifiedHeaders.files.midi;
        let sync = Parser.parseNumber(classifiedHeaders['sync-offset']);
        if(useMRSync) sync += Parser.parseNumber(classifiedHeaders['mr-sync-offset']);
        
        // bpm을 반영해 밀리초로 변환
        classifiedHeaders['ticks-per-beat'] = parseInt(classifiedHeaders['ticks-per-beat'],10) || 120;
        let { lines,bpmChanges } = CommandConverter.parseCommand(commands,headers);
        let bpmc = new BPMConverter(bpmChanges,classifiedHeaders['ticks-per-beat'],sync);
        //console.log(bpmc);
        for(let i in lines){
            lines[i].showTime = bpmc.convertToMs(lines[i].showTime);
            if(lines[i].hideTime){
                //console.log('hideTime',lines[i].hideTime);
                lines[i].hideTime = bpmc.convertToMs(lines[i].hideTime);
                //console.log('hideTime2',lines[i].hideTime);
            }
            for(let j in lines[i].timings){
                lines[i].timings[j].currentBPM = bpmc.getBPM(lines[i].timings[j].start);
                lines[i].timings[j].start = bpmc.convertToMs(lines[i].timings[j].start);
                lines[i].timings[j].end = bpmc.convertToMs(lines[i].timings[j].end);
                if(lines[i].timings[j].splitTimes){
                    lines[i].timings[j].splitTimes = lines[i].timings[j].splitTimes.map(a => {
                        return bpmc.convertToMs(a);
                    });
                }
            }
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
                //console.log(line.startCount);
                if(line.startCount){
                    let beat = 60000/line.timings[0].currentBPM;
                    let startTime = line.timings[0].start;
                    for(let i = 0;i <= line.startCount;i++){
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
                    events.add(line.timings[line.timings.length-1].end,'hidelyrics',{ lineCode:line.lineCode });
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

        if(classifiedHeaders.files.mv){
            let time = classifiedHeaders['mv-timing'] || 0;
            events.add(time,'playmv',{},true);
        }

        return {
            headers:classifiedHeaders,
            rawHeaders:headers,
            events:events.getAll(),
            debug:{
                commands,bpmChanges
            }
        };
    }
}