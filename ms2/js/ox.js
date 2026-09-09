function search() {
	const search_text = $("#ox_search").val().toLowerCase();
	const values = search_text.split(" ").filter((v) => v !== "");
	
	$("#ox_table li").each((idx, li) => {
		var li_text = li.innerText.toLowerCase();
		
		if ((values.some(w => w.length >= 3 && w !== "the" && w !== "and") ||
			 values.filter(w => containsNumber(w)).length >= 2) &&
			values.every((v) => ~li_text.indexOf(v))) {
			$(li).css("display", "");
		} else {
			$(li).css("display", "none");
		}
	});
}

function containsNumber(str) {
	return /\d/.test(str);
}

function handleSearchClick() {
	search();
	focusSearchBar();
}

function setEnabled(isEnabled) {
	var placeholderSearchText;
	if (isEnabled) {
		placeholderSearchText = "Type at least a word with at least 3 letters...";
	} else {
		placeholderSearchText = "loading questions...";
	}
	
	$("#ox_search").attr("placeholder", placeholderSearchText);
	$("#ox_search").prop("disabled", !isEnabled);
	$("#ox_search_button").prop("disabled", !isEnabled);
	$("#ox_refresh_button").prop("disabled", !isEnabled);
}

function clearSearchBar() {
	$("#ox_search").val("");
}

function focusSearchBar() {
	$("#ox_search").focus();
}

var publicSpreadsheetUrl = "https://docs.google.com/spreadsheets/d/1ZNo8-DPNOycviPd-h8n-SabhqWjJoM8a8MxLlwQ-6lY/gviz/tq?tqx=out:json&sheet=OX";

function fetchSheet() {
	let url = publicSpreadsheetUrl;

	return fetch(url, { cache: "no-cache" })
		.then(response => {
			if (!response.ok) {
				throw new Error("Network response was not ok (" + response.status + ")");
			}
			return response.text();
		})
		.then(text => {
			const m = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);?/);
			if (!m) {
				const firstBrace = text.indexOf('{');
				const lastBrace = text.lastIndexOf('}');
				if (firstBrace === -1 || lastBrace === -1) {
					throw new Error("Unexpected spreadsheet response format (no JSON found)");
				}
				m = [null, text.slice(firstBrace, lastBrace + 1)];
			}
			const json = JSON.parse(m[1]);

			const colsMeta = json.table && json.table.cols ? json.table.cols : [];
			const rawRows = (json.table && json.table.rows ? json.table.rows : [])
				.map(r => (r.c || []).map(c => (c && typeof c.v !== "undefined") ? c.v : ""));

			if (rawRows.length === 0) return [];

			const firstRow = rawRows[0].map(v => String(v || "").trim());
			const looksLikeHeader = firstRow.some(v => /question|category|answer|result/i.test(v));

			let headers = [];
			if (looksLikeHeader) {
				headers = firstRow;
				const dataRows = rawRows.slice(1);
				return dataRows.map(r => {
					const obj = {};
					headers.forEach((h, i) => { obj[h] = (typeof r[i] !== "undefined") ? r[i] : ""; });
					return obj;
				});
			} else {
				headers = colsMeta.map(c => (c.label || c.id || "").trim());
				if (headers.every(h => !h)) headers = colsMeta.map(c => (c.id || "").trim());
				if (headers.every(h => !h)) headers = colsMeta.map((_, i) => "col" + i);

				return rawRows.map(r => {
					const obj = {};
					headers.forEach((h, i) => { obj[h] = (typeof r[i] !== "undefined") ? r[i] : ""; });
					return obj;
				});
			}
		});
}

function init() {
    $("[data-toggle=\"tooltip\"]").tooltip().tooltip("hide"); 
	setEnabled(false);
	clearSearchBar();
	
	fetchSheet("OX")
		.then(rows => {
			showInfo(rows);
		})
		.catch(err => {
			console.error("Failed to load spreadsheet:", err);
			setEnabled(true);
		});
}

function reloadData() {
	setEnabled(false);
	
	$("#ox_table li").remove();
	init();
}

function addQuestion(question, result) {
	var ox_li;
	
	if (result) {
		ox_li = $("<li class=\"list-group-item list-group-item-success\" style=\"display: none;\">");
	} else {
		ox_li = $("<li class=\"list-group-item list-group-item-danger\" style=\"display: none;\">");
	}
	
	ox_li.append(question + "</div>");
	
	ox_li.appendTo("#ox_table");
}

function showInfo(rows) {
	var flags = {};
	
	const questions = (rows || [])
		.reduce((a, ox) => {

			const Category = ox.Category || ox.category || ox["Category "] || "";
			const Question = ox.Question || ox.question || ox["Question "] || "";
			const Result = ox.Result || ox.result || ox["Result "] || "";
			

			a.push({ Category: Category, Question: Question, Result: Result });
			return a;
		}, [])
		.filter((e) => {
			if (!e || !e.Question) return false;
			if (flags[e.Question]) {
				return false;
			}
			
			flags[e.Question] = true;
			
			return true;
		})
		.sort(sort_by("Category", "Question", "Result"));
	
	$.each(questions, function(i, ox) {
		addQuestion(ox.Question, ox.Result === "O");
	});
	
	setRefreshButtonTooltip(questions);
	setEnabled(true);
	focusSearchBar();
}

var refreshButtonTooltipFormat;
function setRefreshButtonTooltip(questions) {
	const $refreshButton = $("#ox_refresh_button");
	if (refreshButtonTooltipFormat === undefined ||
		refreshButtonTooltipFormat === "") {
		refreshButtonTooltipFormat = $refreshButton.attr("data-original-title");
	}
	
	$refreshButton.attr("title", refreshButtonTooltipFormat.format(questions.length, questions.filter(q => q.Result === "O").length, questions.filter(q => q.Result === "X").length))
					  .tooltip("_fixTitle");
}

$(document).ready(init);
