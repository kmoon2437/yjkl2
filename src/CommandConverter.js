const Commands = require('./Commands');
const Parser = require('./Parser');
const { TimingEvent } = require('./utilClasses');
const { cloneObject } = require('./utilFunctions');

const STAKATO_MS = 10;
const STAKATO_TICK = 1;

module.exports = class CommandConverter{
    static #convertLine(line){
        //console.log(line.txt);
        // 음절 나누기(ruby와 body가 따로 분리되어 있음)
        let syllables = line.syllables = Parser.parseSentence(line.content);
        //console.log(syllables,line.txt);
        delete line.content;
        let timings = [];
        let oldTimings = [...line.timings];
        
        // 음절에서 띄어쓰기(' ')를 제외한 length
        let slength = syllables.body
        .map(a => a.body.trim())
        .filter(a => a).length;
        if(oldTimings.length < slength){
            // 추가로 넣어야 할 타이밍 이벤트의 수
            let cnt = syllables.body.length-oldTimings.length+1;
            let event = oldTimings.pop();
            let duration = (event.end-event.start)/cnt;
            let ptime = event.start;
            for(let i = 0;i < cnt;i++) oldTimings.push(new TimingEvent(Math.round(ptime+duration*i),Math.round(ptime+duration*(i+1)),event.currentBPM));
        }else if(oldTimings.length > slength){
            // 타이밍 이벤트 합치기
            oldTimings[slength-1].end = oldTimings.pop().end;
            while(oldTimings.length > slength){
                oldTimings.pop();
            }
            //console.log(oldData,syllables)
        }
    
        // 타이밍 데이터에 직접 가사내용을 넣진 않음
        syllables.body.forEach((syll,i,sylls) => {
            if(syll.body == ' '){
                timings.push(new TimingEvent(
                    timings[timings.length-1].end,
                    sylls[i-(-1)] ? sylls[i-(-1)].start : timings[timings.length-1].end,
                    0,[],[1]
                ));
            }else{
                try{
                    timings.push(oldTimings.shift());
                }catch(e){
                    console.log(syllables);
                    throw e;
                }
            }
        });
        
        // 띄어쓰기가 아닌 곳에서 가사를 중간에 멈출 수 없도록 막음
        for(let i in timings){ timings[i].end = timings[i-(-1)] ? timings[i-(-1)].start : timings[i].end; }
    
        line.timings = timings;
        return line;
    }
    // 틱과 밀리초를 같이 사용 불가
    // 여기서 tick단위로 계산한 걸 bpm정보를 가지고 밀리초로 변환
    static parseCommand(commands,headers){
        let playtime = 0;
        /*let initialVerse = {
            showTime:0,
            hideTimeOnEnded:0,
            lines:[],
            count:4
        };*/
        let initialLine = {
            content:'',
            timings:[],
            sub:'',
            params:{},
            showTime:null,
            hideTime:null,
            lineCode:null,
            startCount:0
        };
        let bpmChanges = [];
        let line = cloneObject(initialLine);
        let lines = [];
        let ignoreLine = false;
        let forceStartCount = false;
        for(var cmd of commands){
            switch(cmd.type.toLowerCase()){
                case 'c':{
                    let { name,opts } = Commands.parse(cmd.cmd);
                    let { _unknown:args } = opts;
                    switch(name.toLowerCase()){
                        case 'bpm':{
                            bpmChanges.push({ bpm:Parser.parseNumber(args[0]),time:Parser.parseNumber(args[1]) });
                        }break;
                    }
                }break;
                case 'f':{
                    playtime = cmd.time;
                }break;
                case 'n':{
                    line.lineCode = cmd.lineCode;
                }break;
                case 't':{
                    cmd.timings.forEach(time => {
                        let start = playtime;
                        let parsed = Parser.parseDuration(time);
                        let splitTimes = [];
                        let splitRatio = [];
                        //console.log(a);
                        if(parsed instanceof Array){
                            parsed.forEach(a => {
                                splitTimes.push(playtime += a.time);
                                splitRatio.push(a.ratio);
                            });
                        }else{
                            if(parsed.isDelay){
                                playtime += parsed.time;
                                return;
                            }
                            parsed = [parsed];
                            splitTimes.push(playtime += parsed[0].time);
                            splitRatio.push(parsed[0].ratio);
                        }
                        splitTimes.pop();
                        let end = parsed[parsed.length-1].stakato ? (splitTimes[splitTimes.length-1] || start)+STAKATO_TICK : playtime;
                        line.timings.push(new TimingEvent(Math.round(start),Math.round(end),0,splitTimes,splitRatio));
                    });
                }break;
                case 'l':{
                    // 아래 둘 중 하나라도 없으면 그 줄 자체를 무시
                    // 1. n <숫자> (줄 번호)
                    // 2. p show=<숫자> (가사 표시 타이밍)
                    if(lines.lineCode !== null && lines.showTime !== null){
                        lines.push(this.#convertLine(line));
                    }
                    playtime = 0;
                    line = cloneObject(initialLine);
                }break;
                case 's':{
                    line.content = cmd.sentence;
                }break;
                case 'u':{
                    line.sub = cmd.sentence;
                }break;
                case 'p':{
                    for(let i in cmd.params){
                        if(['show','hide','startCount'].indexOf(i) > -1){
                            switch(i){
                                case 'show': line.showTime = Parser.parseNumber(cmd.params[i]); break;
                                case 'hide': line.hideTime = Parser.parseNumber(cmd.params[i]); break;
                                case 'startCount':
                                    line.startCount = cmd.params[i];
                                    if(line.startCount === true || Number.isNaN(Number(line.startCount))){
                                        line.startCount = 4;
                                    }else{
                                        line.startCount = Math.min(Math.max(line.startCount,0),4);
                                    }
                                break;
                            }
                        }else line.params[i] = cmd.params[i];
                    }
                }break;
            }
        }

        return { lines,bpmChanges };
    }
}