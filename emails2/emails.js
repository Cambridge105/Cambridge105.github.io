var maxUid = 0;
var tempKey = "";

function getLatestUidFromCookie() {
    let name = "latestUid=";
    let decodedCookie = decodeURIComponent(document.cookie);
    let ca = decodedCookie.split(';');
    for(let i = 0; i <ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) == ' ') {
        c = c.substring(1);
      }
      if (c.indexOf(name) == 0) {
        maxUid = c.substring(name.length, c.length);
        maxUid = maxUid - 20; //Because on first load we want at least 20 messages
      }
    }
    if (maxUid == 0) {
       maxUid = 183960;
    }
}


function setLatestUidIntoCookie(uid) {
        const d = new Date();
        d.setTime(d.getTime() + (30 * 24 * 60 * 60 * 1000));
        let expires = "expires="+d.toUTCString();
        document.cookie = "latestUid=" + uid + ";" + expires + ";path=/";
}




function loadMessages() {
    $('#status').html('Loading messages...');
    $.ajax({
        beforeSend: function(request) {
            request.setRequestHeader("X-API-KEY",tempKey);
        },
        dataType: "json",
        url: "https://domsmith.co.uk/c105/emailscreen/proxy.php?uid=" + maxUid,
        success: function(json) {
            handleMessages(json);
            now = new Date();
            now = now.toISOString();
            $('#last_update').html(now);
            if ($('#loaded_time').html() == "0")
            {
                $('#loaded_time').html(now);
            }
            $('#status').html('Waiting for next request');
        }
    })
}

function handleMessages(json) {
    if ($("#placeholder").length > 0) {$("#placeholder").remove();}
    if ($("#loginPlaceholder").length > 0) {$("#loginPlaceholder").remove();}
    content = $("#contentMain").html()
    msgsLen = json.length;
    if (msgsLen > 20) {msgsLen = 20;}
    html = "";
    for (i=0; i<msgsLen; i++) {
        html += parseMsg (json[i]);
    }
    $("#contentMain").html(html + content);
    if ($("#maxUid").val() != maxUid)
    {
        setLatestUidIntoCookie(maxUid);
        $("#maxUid").val(maxUid);
    }
    updateExistingMessages();
    
}

function parseMsg(obj) {
    // If an article for this ID already exists, do nothing
    if ($('#' + obj.Uid).length>0) {return "";}
    // Determine message method
    method_str = obj.From.substring(0,obj.From.indexOf("\"",2)+1);
    if (obj.Subject.indexOf("hatsApp") >0) {
        method = "WhatsApp";
        sender = obj.Subject.replace("WhatsApp from ","");
    }
    else if (obj.From.indexOf("SMS") > 0) {
        method = "Text Message";
        sender = obj.Subject.substring(obj.Subject.indexOf("from ")+5, obj.Subject.indexOf(" - "));
    }
    else if (obj.From.indexOf("admin@cambridge105.co.uk") > 1) {
        method="Email via Website"; 
        sender = method_str.replaceAll("\"","");
        obj.BodySummary = obj.BodySummary.replace("Email via the Cambridge Radio website – from ", "");
        obj.BodySummary = obj.BodySummary.replace(sender, "");
    }
    else {
        method = "Email"; 
        sender = method_str.replaceAll("\"","");
        obj.BodySummary = "<b>" + obj.Subject + "</b><br>" + obj.BodySummary;
        obj.BodyFull = "<b>" + obj.Subject + "</b><br>" + obj.BodyFull;
    }
    date = handleDateString(obj.DateString);
    classOverride = "";
    if (date == "More than 3 hours ago")
    {
        obj.BodySummary = "You are not authorised to view messages over 3 hours old";
        obj.BodyFull =  "You are not authorised to view messages over 3 hours old";
        classOverride = "read";
    }
    else if ((date.indexOf(" ago") > 1) || (date=="Now"))
    {
        classOverride = "new";
    }
    html = "<article class=\"msg " + classOverride + "\" id=\"" + obj.Uid + "\"><div class=\"msg_meta\"><div class=\"msg_meta_from\">From: <span class=\"msg_meta_value\">"  + sender + "</span></div> <div class=\"msg_meta_via\">via: <span class=\"msg_meta_value\">" + method + "</span></div> <div class=\"msg_meta_time\">Time: <span class=\"msg_meta_value\" id=\"" + obj.Uid + "-ds\">" + date + "</span></div><input type=\"hidden\" id=\"" + obj.Uid + "-ts\" value=\"" + obj.DateString + "\"></div>";
    html += "<div id=\"" + obj.Uid + "-body\">" + formatMsgBody(obj.BodySummary, obj.BodyFull) + "</div>";
    html += "<div class=\"msg_actions\"><button onClick=\"markRead(" + obj.Uid + ")\" id=\"" + obj.Uid + "-rb\">Read</button> </div></article>"
    if (obj.Uid > maxUid) {maxUid = obj.Uid;}
    return html;    
    
}

function getSenderFromSubject(subject, method) {
    sender = "";
    if (method=="Text Message") {
        return subject.substring(subject.indexOf("from ")+5, subject.indexOf(" - "));
    }
    if (sender == "") {
        sender = "(Unknown - " 
        if (Number.isInteger(subject.substring(subject.length - 4))) { 
            sender += "ends " + subject.substring(subject.length - 4) // Phone number
        }
        else {
            var n = words.split(" ");
            emailAddr =  n[n.length - 1];
            sender += emailAddr.substring(0,emailAddr.indexOf("@")) + "@xxxxxxx";
        }
        sender += ")";
    }
    return sender;
}

function handleDateString(dateStr) {
    ts = Date.parse(dateStr);
    now = Date.now();
    ts_diff = now - ts;
    if (ts_diff < 60000) {return "Now";}
    else if (ts_diff < 120000) {return "1 min ago";}
    else if (ts_diff < 600000) {return Math.floor((ts_diff/1000)/60) + " mins ago"}
    else if (ts_diff > 10800000) {return "More than 3 hours ago"}
    else {return dateStr;}

}

function formatMsgBody(summary, full) {
    if (full.indexOf("FLAGS (\\Seen))") > 1) {
        msgSum = summary.substring(0, summary.indexOf("FLAGS (\\Seen))"));
        msgFull = full.substring(0, full.indexOf("FLAGS (\\Seen))"));
    }
    else { msgSum = summary; msgFull = full;}
    if (msgSum.length < 1) {
        return "<p>(Blank message received from server)</p>";
    }
    else if (msgSum.length < 314) { // SMS message = 160 chars, or 153 if concatenated, so this is two messages (153+160=313)
        return "<p>" + msgSum + "</p>";
    }
    return "<details><summary>" + msgSum.substring(0,313) + "... <span class=\"summary_click\">(Click to expand)</span></summary><p>" + msgFull + "</p></details>";
}

/*
function markImportant(uid) {
    $('#' + uid).removeClass('new');
    $('#' + uid).addClass('important');
}*/

function markRead(uid) {
    $('#' + uid).removeClass('new');
    $('#' + uid).addClass('read');
    $('#' + uid + '-rb').prop('disabled', true);
    updateExistingMessages();
}

function updateTimeOnExistingMessage(uid) {
    if ($('#' + uid + '-ts').length > 0) {
        dateString = $('#' + uid + '-ts').val();
        result = handleDateString(dateString);
        $('#' + uid + '-ds').html(result);
        isSetToRead =  $('#' + uid).hasClass('read');
        if (result == "More than 3 hours ago") {
            $('#' + uid + "-body").html("<p>You are not authorised to view messages over 3 hours old</p>");
            $('#' + uid + '-rb').prop('disabled', true);
            $('#' + uid).addClass('read');
        }
        else if ((result.indexOf(" ago") > 0) && (!isSetToRead)) {
            $('#' + uid).addClass('new');
        }
        else if ((result == "Now") && (!isSetToRead)) {
            $('#' + uid).addClass('new');
        }
        else {
            $('#' + uid).removeClass('new');
        }
    }
}

function updateExistingMessages() {
    var messages = $(".msg");
    unreadMsgs = messages.length;
    messages.each(function() {
        uid =  this.id;
        updateTimeOnExistingMessage(uid); 
        if ($('#' + uid).hasClass('read')) {
            unreadMsgs = unreadMsgs - 1;
        }
    });
    document.title = "(" + unreadMsgs + ") Cambridge Radio Test Email Screen"; 
}

