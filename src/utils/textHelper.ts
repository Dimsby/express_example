import Autolinker from 'autolinker';

const autolinker = new Autolinker( {
    truncate: 20,
    sanitizeHtml: true
});

export const findHashtags = (text: string): string[] => {
    const matches = text.match(/#(\w+)/g)
    return matches ? matches.map(x => x.substr(1)) : []
}

export const convertLinks = (text: string): string => autolinker.link(text);