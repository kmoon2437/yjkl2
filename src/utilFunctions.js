function cloneObject(obj){
    var newobj = {};
    for(var i in obj){
        if(typeof obj[i] == 'object' && obj[i] !== null){
            if(obj[i] instanceof Array) newobj[i] = [...obj[i]];
            else newobj[i] = cloneObject(obj[i]);
        }
        else newobj[i] = obj[i];
    }

    return newobj;
}

function classifyHeader(headers2){
    let headers = cloneObject(headers2);
    let files = {};

    for(var i in headers){
        if(i.match(/^file-/g)){
            files[i.replace(/(@?)file-/i,'')] = headers[i];
            delete headers[i];
        }
        /*else if(i.match(/^meta-/g)){
            classified.meta[i.replace('meta-','')] = headers[i];
            delete headers[i];
        }*/
    }

    // 즉 헤더 이름으로 files는 사용할 수 없음
    headers.files = files;

    return headers;
}

module.exports = {
    cloneObject,classifyHeader
}