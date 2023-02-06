const Commands = require('./Commands');
const Parser = require('./Parser');
const { TimingEvent } = require('./utilClasses');
const { cloneObject } = require('./utilFunctions');

const STAKATO_MS = 10;
const STAKATO_TICK = 1;

module.exports = class LineConverter{
    static convert(data){
        let lines = [];
        data.lyrics.forEach(line => {
            if(!line.line || !line.showTime) return;
            let syllables = [];
            let timings = [];
            let playtime = line.start;
            line.data.forEach(a => {
                // 객체인 경우
                if(!(a instanceof Array) && typeof a == 'object' && a !== null){
                    // 구현한 게 딱히 없음
                    if(a.type == ''){}
                    return;
                }

                // 배열인 경우
                let syll = { content:a.shift() };
                if(typeof a[a.length-1] == 'object' && !(a instanceof Array)){
                    syll.params = a.pop(); // 특정 글자에만 스타일을 설정하는 경우
                }
                syllables.push(syll);
                let start = playtime;
                let splitRatio = [];
                a.forEach(duration => {
                    if(duration instanceof Array){
                        playtime += duration[1];
                        splitRatio.push(duration[0]);
                    }else{
                        playtime += duration;
                        splitRatio.push(1);
                    }
                    splitTimes.push(playtime);
                });
                splitTimes.pop(); // 중간에 나눌 타이밍만 넣기 위함
                let gcd = Parser.calcGCD(splitRatio);
                splitRatio = splitRatio.map(a => a / gcd);
                timings.push({
                    start,end:syll.params.s ? start+STAKATO_TICK : playtime,
                    currentBPM:0,splitTimes,splitRatio
                });
            });

            let cleanedSyllables = [];
            lines.push({
                showTime:line.show,
                hideTime:line.hide || null,
                sub:line.sub,
                params:line.params,timings,
                syllables:cleanedSyllables
            });
        });
        return lines;
    }
}