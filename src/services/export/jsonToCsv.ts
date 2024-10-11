import {parseAsync, AsyncParser } from 'json2csv';

const options = {
    'excelStrings': false,
    'delimiter': ','
}

const export2Csv = async (data, fields?): Promise<any> =>  {
    return parseAsync(data, {...options, fields})
}

export default {export2Csv}