// @flow
import "core-js/stable";
import "core-js/features/url";

const cheerio = require("cheerio");
const CryptoJS = require("crypto-js");

class ChapterListItem {
    number: string;
    // Number is the chapter number. Could be an actual number like "1" or could
    // be a special chapter like "EX" or "Omake".
    //
    title: string;
    // Name is the short title of the chapter.
    // 
    description: string;
    // Description is the longer description of the chapter. May be blank
    // depending on the way the website handles information about chapters.
    // 
    identifier: string;
    // Identifier is a source-specific identifier. Could be an id like "1234" or
    // anything that makes sense for this source. This identifier will be
    // provided in getChapter call as chapterIdentifier to retrieve the chapter
    // pages.
    // 
    group: ?string
    // Optional: Scanalation group if one exists.
    // 
    variant: ?string
    // Optional: Set variant if there are multiple versions of the same chapter
    //           and group is not present or not enough to differintiate.
    //
    created: ?Date
    // Optional: Date created as a string if it exists.

    updated: ?Date
    // Optional: Date updated as a string if it exists.

    published: ?Date
    // Optional: Date of original chapter's publication as a string if it exists.

    constructor({
        number,
        identifier,
        title,
        description = "",
        group = null,
        variant = null,
        created = null,
        updated = null,
        published = null,
    }: {
        number: string,
        identifier: string,
        title: string,
        description?: string,
        group?: ?string,
        variant?: ?string,
        created?: ?Date,
        updated?: ?Date,
        published?: ?Date,
    }) {
        this.number = number;
        this.identifier = identifier;
        this.title = title;
        this.description = description;
        this.group = group;
        this.variant = variant;
        this.created = created;
        this.updated = updated;
        this.published = published;
    }
}

class ChapterList {
    chapters: Array<ChapterListItem>;
    // Chapters contains all the chapters for a given manga series.
    //

    constructor({ chapters }: { chapters: Array<ChapterListItem> }) {
        this.chapters = chapters;
    }
}


type PageDataHandler = (string) => (string);

class PageData {
    version: string = "1.0.0"
    highUrl: string
    lowUrl: ?string
    highHandler: ?PageDataHandler
    lowHandler: ?PageDataHandler

    constructor({
        highUrl,
        lowUrl = null,
        highHandler = null,
        lowHandler = null,
    }: {
        highUrl: string,
        lowUrl?: ?string,
        highHandler?: ?PageDataHandler,
        lowHandler?: ?PageDataHandler,
    }) {
        this.highUrl = highUrl;
        this.lowUrl = lowUrl;
        this.highHandler = highHandler;
        this.lowHandler = lowHandler;
    }
}

class ChapterData {
    version: string = "2.0.0"

    pages: Array<PageData>

    constructor({ pages }: { pages: Array<PageData> }) {
        this.pages = pages
    }
}

class MangaSeries {
    name: string;
    // Name is the name of the manga series.
    // 
    identifier: string;
    // Identifier is the id or unique identifier for this manga series on this
    // source.
    // 
    coverUrl: ?string;
    // NOTE: Optional
    // The coverUrl if one exists. Used to help users identify best matches.
    ranking: number;
    // NOTE: Optional
    // Ranking is the a representation of the likelyhood of this result being
    // the correct match. 0 being the best match and Number.MAX_SAFE_INTEGER
    // being the worst match. All negative numbers will be treated as equal.
    // 

    constructor({
        name,
        identifier,
        coverUrl = null,
        ranking = -1,
    }: {
        name: string,
        identifier: string,
        coverUrl?: ?string,
        ranking?: number,
    }) {
        this.name = name;
        this.identifier = identifier;
        this.coverUrl = coverUrl;
        this.ranking = ranking;
    }
}

class MangaSeriesList {
    results: Array<MangaSeries> = [];
    // Results is the list of all MangaSeries objects which match this query in
    // a searchManga call.

    constructor({ results = [] }: { results: Array<MangaSeries> }) {
        this.results = results;
    }
}

export const EXTENSION_ID: string="52b3a063-ce43-4c21-ae37-4b7cae945306";

const BASE_URL = "https://mangakatana.com";

function parsePage($): Array<MangaSeries> {
    const elements = $("div#series-list div.col.no-flag");
    const idRegex = /\/series\/(?<id>\d+)\/[^\/]*/;

    const results: Array<?MangaSeries> = elements.map((i, result) => {
        const title = $(result).find("a.item-title");
        console.debug(`title: ${title}`);
        const cleanedTitle = title.text().replace(/\s+/g, " ").replace(/&amp;/g, "&").trim();
        console.log(`cleanedTitle: ${cleanedTitle}`);
        const url = title.attr("href");
        const idMatch = url.match(idRegex);
        if (!idMatch || idMatch.length <= 1) {
            return null;
        }
        const id = idMatch[1];
        console.debug(`id: ${id}`);

        const coverElem = $(result).find("a.item-cover > img")
        const coverUrl = coverElem.attr("src");

        const newSeries = new MangaSeries({
            identifier: id.toString(),
            name: cleanedTitle.toString(),
            ranking: i,
            coverUrl: coverUrl.toString()
        });
        console.debug(newSeries);
        return newSeries;
    }).toArray();

    const finalResults: Array<MangaSeries> = results.filter(Boolean);

    return finalResults;
}

export async function searchSeries(
    seriesName: string, offset: number=0, limit: number=10
): Promise<MangaSeriesList> {
    console.debug("searchManga called.", {seriesName, offset, limit});

    let finalUrl = new URL(`${BASE_URL}`);
    let searchParams = new URLSearchParams({
        search: seriesName,
        search_by: "book_name"
    });
    finalUrl.search = searchParams.toString();

    const sanitizedName = seriesName.replace(/\w+/g, "+");

    let currentUrl = finalUrl;
    let allResults = [];
    while (true) {
        let response = await fetch(currentUrl);
        const text = await response.text();

        const $ = cheerio.load(text);

        const pageResults = $("#book_list > .item").map((i, element) => {
            const titleElem = $(element).find(".title > a");
            const cleanedTitle = titleElem.text().replace(
                /\s+/g, " "
            ).replace(
                /&amp;/g, "&"
            ).trim();
            const url = titleElem.attr("href");
            const urlComponents = (new URL(url)).pathname.split("/");
            const id = urlComponents[urlComponents.length-1];

            const coverElem = $(element).find("img[alt='[cover]' i]");
            const coverUrl = coverElem.attr("src");

            const newSeries = new MangaSeries({
                identifier: id.toString(),
                name: cleanedTitle.toString(),
                ranking: i,
                coverUrl: coverUrl.toString()
            });
            console.debug(newSeries);
            return newSeries;
        }).toArray();

        if ((allResults.length + pageResults.length) < limit) {
            allResults = allResults.concat(pageResults);
        } else {
            const remaining = limit - allResults.length;
            const end = Math.min(remaining, pageResults.length);
            const subset = pageResults.slice(0, end);
            allResults = allResults.concat(subset);
        }

        if (allResults.length >= limit) {
            console.debug("Limit reached.")
            break;
        }

        const nextPageElem = $("a.next.page-numbers").get(0);
        if (!nextPageElem) {
            console.debug("No more pages left")
            break;
        }

        const nextPageUrl = nextPageElem.attr("href");
        currentUrl = new URL(nextPageUrl);
    }

    console.debug(allResults.length);

    return new MangaSeriesList({
        results: allResults,
    });
}

export async function seriesInfo(seriesIdentifier: string): Promise<MangaSeries> {
    const finalUrl = new URL(`${BASE_URL}/manga/${seriesIdentifier}`);

    const response = await fetch(finalUrl);
    const text = await response.text();

    const $ = cheerio.load(text);

    const container = $("#single_book");

    const coverElem = container.find(".cover > img");
    const coverUrl = coverElem.attr("src");

    const titleElem = container.find(".info > .heading");
    const cleanedTitle = titleElem.text().replace(/\s+/g, " ").replace(/&amp;/g, "&").trim();

    return new MangaSeries({
        identifier: seriesIdentifier,
        name: cleanedTitle.toString(),
        ranking: 0,
        coverUrl: coverUrl.toString()
    });
}

export async function listChapters(
    seriesIdentifier: string,
    offset: number=0,
    limit: number=500,
    since: ?Date=null,
    order: string='asc'
): Promise<ChapterList> {
    const finalUrl = new URL(`${BASE_URL}/manga/${seriesIdentifier}`);

    const response = await fetch(finalUrl);
    const text = await response.text();

    const $ = cheerio.load(text);
    const container = $(".chapters");
    const chapterNumberRegex = /ch(?:ap(?:ter)?)?[\s\.]*(\d+(\.\d+)?)/i;
    const chapters = container.find(".chapter").map((i, element) => {
        const titleElem = $(element).find("a");
        const title = titleElem.text();
        const cleanedTitle = $(titleElem).text().replace(/\s+/g, " ").trim();

        const numberMatch = cleanedTitle.match(chapterNumberRegex);
        if (!numberMatch) {
            return null;
        }

        const container = $(element).closest("tr");
        const updateElem = container.find(".update_time");

        const number = numberMatch[1];
        const url = new URL(titleElem.attr("href"));
        const urlComponents = url.pathname.split("/");
        const chapterId = urlComponents[urlComponents.length-1];
        const updated = Date.parse(updateElem.text());

        const identifier = {
            chapId: chapterId,
            seriesId: seriesIdentifier,
        };

        return new ChapterListItem({
            identifier: btoa(JSON.stringify(identifier)).toString(),
            title: cleanedTitle.toString(),
            number,
            // group: groupName,
            // created: createdAt,
            updated,
            // published: publishAt,
        });
    });

    // console.debug(`Creating final chapter list.`, { chapters });
    const chapList = new ChapterList({
        chapters: chapters,
    });

    return chapList;
}

export async function getChapter(chapterIdentifier: string): Promise<ChapterData> {
    // TODO: implement get chapter logic here.
    //
    const { chapId, seriesId } = JSON.parse(atob(chapterIdentifier));

    let response = await fetch(
        `${BASE_URL}/manga/${seriesId}/${chapId}`
    );
    let text = await response.text();

    const $ = cheerio.load(text);

    const script = $("script:contains('data-src')").text();

    const pageArrRegex = /\[[^\]]+,['"][^'"]+1\.(jpg|png|jpeg)["'][^\]]+]/gi;

    const arrString = script.match(pageArrRegex)[0];

    const arr = eval(arrString);

    console.log(script);
    console.log(arrString);

    const pages = arr.map((highUrl) => {
        return new PageData({
            highUrl,
        });
    });

    
    return new ChapterData({ pages });
}
