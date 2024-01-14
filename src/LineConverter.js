const Parser = require('./Parser.js');

function processTiming(content, offset = 0) {
    let lastI = 0;
    let lastJ = 0;
    let isLyric = false;
    for (let i in content) {
        if (content[i].type != 'lyric') {
            if (!isLyric) lastI++;
            continue;
        }
        i = parseInt(i, 10);
        isLyric = true;
        for (let j in content[i].syllables) {
            j = parseInt(j, 10);
            let oldTiming = content[i].syllables[j].timing;
            let [start, end] = oldTiming.time;
            let timing = {
                start: null,
                end: null,
                splitTimes: [],
                splitRatio: []
            };
            if (Parser.isValidNumber(end)) {
                timing.end = Parser.parseNumber(end);
            }
            if (start instanceof Array) {
                start.forEach(time => {
                    if (time instanceof Array) {
                        timing.splitTimes.push(Parser.parseNumber(time[1]));
                        timing.splitRatio.push(time[0]);
                    } else {
                        timing.splitTimes.push(Parser.parseNumber(time));
                        timing.splitRatio.push(1);
                    }
                });
                timing.start = timing.splitTimes.shift();
            } else {
                timing.start = Parser.parseNumber(start);
            }
            if (
                !(i == lastI && j == lastJ) &&
                content[lastI] &&
                content[lastI].syllables[lastJ] &&
                (typeof content[lastI].syllables[lastJ].timing.end == 'undefined' ||
                    content[lastI].syllables[lastJ].timing.end === null)
            ) {
                content[lastI].syllables[lastJ].timing.end = timing.start;
            }
            let gcd = Parser.calcGCD(timing.splitRatio);
            timing.splitRatio = timing.splitRatio.map(a => a / gcd);
            content[i].syllables[j].timing = timing;
            lastJ = j;
            lastI = i;
        }
    }
    for (let i in content) {
        for (let j in content[i].syllables) {
            content[i].syllables[j].timing.start += offset;
            content[i].syllables[j].timing.end += offset;
            content[i].syllables[j].timing.splitTimes = content[i].syllables[j].timing.splitTimes.map(a => a + offset);
        }
    }
    return content;
}

module.exports = class LineConverter {
    static convert(data) {
        let lines = [];
        data.lyrics.forEach(line => {
            line.show = Parser.parseNumber(line.show);
            if (line.hide) line.hide = Parser.parseNumber(line.hide);
            if (line.offset) {
                line.offset = Parser.parseNumber(line.offset);
            } else {
                line.offset = 0;
            }
            line.show += line.offset;
            if (line.hide) line.hide += line.offset;
            if (typeof line.line != 'number' || line.show < 0) return;
            let content = [];

            line.data.forEach(a => {
                // 객체인 경우
                if (!(a instanceof Array) && typeof a == 'object') {
                    if (a === null) return;
                    a.type = a.type || 'block';
                    if (a.type == 'block') {
                        let block = {
                            type: 'lyric',
                            ruby: a.ruby,
                            style: a.style,
                            syllables: []
                        };
                        a.data.forEach(b => {
                            let syll = { content: b.shift(), style: null };
                            if (typeof b[b.length - 1] == 'object' && !(b[b.length - 1] instanceof Array)) {
                                syll.params = b.pop(); // 특정 글자에만 스타일을 설정하는 경우 등
                            } else syll.params = {};
                            syll.timing = { time: b };
                            block.syllables.push(syll);
                        });
                        content.push(block);
                    } else if (a.type == 'icon') {
                        content.push(a);
                    }
                } else {
                    // 배열인 경우
                    let syll = { content: a.shift(), style: null };
                    if (typeof a[a.length - 1] == 'object' && !(a[a.length - 1] instanceof Array)) {
                        syll.params = a.pop(); // 특정 글자에만 스타일을 설정하는 경우 등
                    } else syll.params = {};
                    let ruby;
                    if (syll.content instanceof Array) {
                        let [body, rubyy] = syll.content;
                        syll.content = body;
                        ruby = rubyy;
                    } else {
                        ruby = '';
                    }
                    syll.timing = { time: a };
                    content.push({
                        type: 'lyric',
                        ruby,
                        style: syll.params.style,
                        syllables: [syll]
                    });
                }
            });

            // 가사 처리
            for (let i in content) {
                if (content[i].type != 'lyric') continue;
                for (let j in content[i].syllables) {
                    if (content[i].syllables[j].params.style) {
                        content[i].syllables[j].style = content[i].syllables[j].params.style;
                        delete content[i].syllables[j].params.style;
                    }
                }
            }

            // 타이밍 처리
            content = processTiming(content, line.offset || 0);

            lines.push({
                lineCode: line.line,
                showTime: line.show,
                hideTime: line.hide || null,
                sub: line.sub,
                style: line.style || null,
                params: line.params || {},
                content
            });
        });
        return lines;
    }
};
