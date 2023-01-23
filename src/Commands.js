const parseCommand = require('command-line-args');

var opts = {};

/**
 * bpm 설정
 */
opts['bpm'] = [];

/**
 * 몇부터 카운트할지 설정. 최대값은 4
 */
opts['count'] = [];

module.exports = class Commands{
    static parse(cmdArgs){
        // 명령어 이름을 없애고 파싱
        let newArgs = [...cmdArgs];
        newArgs.shift();
        return {
            name:cmdArgs[0].toLowerCase(),
            opts:parseCommand(opts[cmdArgs[0].toLowerCase()] || [],{
                argv:newArgs,
                partial:true
            })
        };
    }
}