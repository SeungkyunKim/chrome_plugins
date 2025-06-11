function findElementsByTagName(tagName) {
    return document.getElementsByTagName(tagName);
}

function replaceTextInElements(elements, textToFind, textToReplace) {
    for (let element of elements) {
        if (element.childNodes.length > 0) {
            for (let child of element.childNodes) {
                if (child.nodeType === Node.TEXT_NODE) {
                    child.nodeValue = child.nodeValue.replace(new RegExp(textToFind, 'g'), textToReplace);
                }
            }
        }
    }
}

export { findElementsByTagName, replaceTextInElements };