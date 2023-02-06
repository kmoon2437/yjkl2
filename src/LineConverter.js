const Parser = require('./Parser');

const STAKATO_TICK = 1;

module.exports = class LineConverter{
    static convert(data){
        let lines = [];
        data.lyrics.forEach(line => {
            if(typeof line.line != 'number' || line.showTime < 0) return;
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
                if(typeof a[a.length-1] == 'object' && !(a[a.length-1] instanceof Array)){
                    syll.params = a.pop(); // 특정 글자에만 스타일을 설정하는 경우
                }
                syllables.push(syll);
                let start = playtime;
                let splitRatio = [];
                let splitTimes = [];
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
                    start,end:syll.params?.s ? (splitTimes[splitTimes.length-1] ?? start)+STAKATO_TICK : playtime,
                    currentBPM:0,splitTimes,splitRatio
                });
            });

            let syllParams = syllables.map(a => a.params);
            let syllLengths = syllables.map(a => a.content.length);
            let cleanedSyllables = Parser.parseRubySyntax(
                syllables.map(a => a.content).join(''),syllLengths
            );
            cleanedSyllables.body = cleanedSyllables.body.map((a,i) => {
                return { style:syllables[i].params?.style || null,body:a };
            });

            lines.push({
                lineCode:line.line,
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