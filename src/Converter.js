const LineConverter = require('./LineConverter.js');
const Events = require('./Events.js');
const BPMConverter = require('./BPMConverter.js');

function getFirstLyricIndex(content) {
    for (let i in content) {
        if (content[i].type == 'lyric') return i;
    }
}

function getLastLyricIndex(content) {
    for (let i = content.length - 1; i >= 0; i--) {
        if (content[i].type == 'lyric') return i;
    }
}

module.exports = class Converter {
    static convert(data, opts) {
        opts = Object.assign({
            enableMsec: false,
            defaultFadeOutTime: 1000,
            interludeDelay: 0,
            fadeOutInterludeDelay: 500,
            showinfoDelay: 150,
            fadeOutShowinfoDelay: 500
        }, opts);

        data.info = data.info || {};
        data.files = data.files || {};
        data.meta = data.meta || data.config || {};

        // data는 json 파싱이 됐다고 가정
        let useAudioSync = opts.forceAudioSync ? true : !data.files.midi;
        let sync = data.meta.syncOffset || 0;
        if (useAudioSync) sync += data.meta.audioSyncOffset || 0;

        // 템포를 반영해 밀리초로 변환
        data.meta.ticksPerBeat = data.meta.ticksPerBeat || 120;
        let lines = LineConverter.convert(data);
        let bpmc = new BPMConverter(data.tempo, data.meta.ticksPerBeat, sync);
        for (let i in lines) {
            lines[i].showTime = bpmc.convertToMs(lines[i].showTime);
            if (lines[i].hideTime) {
                lines[i].hideTime = bpmc.convertToMs(lines[i].hideTime);
            }
            for (let j in lines[i].content) {
                if (lines[i].content[j].type != 'lyric') continue;
                for (let k in lines[i].content[j].syllables) {
                    lines[i].content[j].syllables[k].timing.currentBPM = bpmc.getBPM(
                        lines[i].content[j].syllables[k].timing.start
                    );
                    lines[i].content[j].syllables[k].timing.start = bpmc.convertToMs(
                        lines[i].content[j].syllables[k].timing.start
                    );
                    lines[i].content[j].syllables[k].timing.end = bpmc.convertToMs(
                        lines[i].content[j].syllables[k].timing.end
                    );
                    if (lines[i].content[j].syllables[k].timing.splitTimes) {
                        lines[i].content[j].syllables[k].timing.splitTimes = lines[i].content[j].syllables[
                            k
                        ].timing.splitTimes.map(a => bpmc.convertToMs(a));
                    }
                }
            }
        }

        // 줄 번호에 따라 분류
        let classifiedLines = {};
        lines.forEach(line => {
            if (!classifiedLines[line.lineCode]) {
                classifiedLines[line.lineCode] = [];
            }
            classifiedLines[line.lineCode].push(line);
        });

        // 이벤트 형식으로 변환
        let events = new Events();
        let interludeEndTimes = [];
        let hideTimes = [[0, false]];
        let isLastHideFadeOut = false;
        let lastHideFadeOutTime = 0;
        for (let i in classifiedLines) {
            classifiedLines[i].forEach((line, j) => {
                if (line.params.startCount) {
                    let t = line.content[getFirstLyricIndex(line.content)].syllables[0].timing;
                    let beat = 60000 / t.currentBPM;
                    let startTime = t.start;
                    if (typeof line.params.interlude != 'boolean') {
                        interludeEndTimes.push(line.showTime);
                    } else if (line.params.interlude) {
                        interludeEndTimes.push(line.showTime);
                    }
                    let count =
                        typeof line.params.startCount == 'number'
                            ? Math.max(1, Math.min(4, line.params.startCount))
                            : 4;
                    for (let i = 0; i <= count; i++) {
                        events.add(startTime - beat * i, 'countdown', { val: i || null, lineCode: line.lineCode });
                    }
                } else if (typeof line.params.interlude == 'boolean' && line.params.interlude) {
                    interludeEndTimes.push(line.showTime);
                }
                events.add(line.showTime, 'renderlyrics', line);
                // 어차피 숨김 이벤트가 없어도
                // 다음에 같은 위치에 다른 가사가 오면
                // 렌더링할 때 그걸로 대체됨
                if (line.hideTime && line.showTime < line.hideTime) {
                    hideTimes.push([
                        line.hideTime,
                        line.params.fadeOut,
                        line.params.fadeOutTime || opts.defaultFadeOutTime
                    ]);
                    events.add(line.hideTime, 'hidelyrics', {
                        lineCode: line.lineCode,
                        fadeOut: line.params.fadeOut,
                        fadeOutTime: line.params.fadeOutTime || opts.defaultFadeOutTime
                    });
                    isLastHideFadeOut = line.params.fadeOut;
                    lastHideFadeOutTime = line.params.fadeOutTime || opts.defaultFadeOutTime;
                } else if (j == classifiedLines[i].length - 1) {
                    // 근데 이게 마지막이면 다음 가사가 없으므로
                    // 이 가사가 끝나는 즉시 가사를 숨김
                    let t = line.content[getLastLyricIndex(line.content)];
                    t = t.syllables[t.syllables.length - 1];
                    hideTimes.push([
                        t.timing.end,
                        line.params.fadeOut,
                        line.params.fadeOutTime || opts.defaultFadeOutTime
                    ]);
                    events.add(t.timing.end, 'hidelyrics', {
                        lineCode: line.lineCode,
                        fadeOut: line.params.fadeOut,
                        fadeOutTime: line.params.fadeOutTime || opts.defaultFadeOutTime
                    });
                    isLastHideFadeOut = line.params.fadeOut;
                    lastHideFadeOutTime = line.params.fadeOutTime || opts.defaultFadeOutTime;
                }
            });
        }

        let DEBUG = {};
        let keys = Object.keys(events.getAll())
            .map(a => parseFloat(a))
            .filter(a => !Number.isNaN(a));
        DEBUG.stimes = keys;
        let firstEventTime = Math.min(...keys);
        firstEventTime = Math.max(firstEventTime - 1500, 0);
        let lastEventTime = Math.max(...keys);
        // 재생후 firsteventtime에 도달하지 않아도 10초가 되면 cleangui 실행
        // 참고로 cleangui는 제목 숨기기 이벤트
        events.add(Math.min(10000, firstEventTime), 'cleangui', {}, true);
        events.add(0, 'hidelyrics', {}, true);

        hideTimes = hideTimes.sort((a, b) => b[0] - a[0]);
        for (let t of interludeEndTimes) {
            let hideTimeArr = hideTimes.filter(a => a[0] <= t)[0];
            if (!hideTimeArr) continue;
            let [s, isFadeOut, fadeOutTime] = hideTimeArr;
            events.add(s + (isFadeOut ? fadeOutTime + opts.fadeOutInterludeDelay : opts.interludeDelay), 'interlude', {
                endTime: t
            });
        }

        events.add(
            lastEventTime + (isLastHideFadeOut ? lastHideFadeOutTime + opts.fadeOutShowinfoDelay : opts.showinfoDelay),
            'showinfo',
            {}
        );
        events.add(
            lastEventTime +
                (isLastHideFadeOut ? lastHideFadeOutTime + opts.fadeOutShowinfoDelay : opts.showinfoDelay) +
                7500,
            'cleangui',
            {}
        );

        if (data.files.mv) {
            let time = data.files.mvTiming || 0;
            events.add(time, 'playmv', {}, true);
        }

        return {
            DEBUG,
            info: data.info,
            files: data.files,
            meta: data.meta,
            events: events.getAll(),
            lyricLines: lines
        };
    }
}