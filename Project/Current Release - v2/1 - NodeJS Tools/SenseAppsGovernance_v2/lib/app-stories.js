var qsocks = require('qsocks');
var fs = require('fs');
var request = require('request');
var js2xmlparser = require('js2xmlparser');
var Promise = require("promise");
var log = require("./logger");

module.exports={
  getAppStories: function(conn_data, global, cookies, single_app, logging){
    var promise_str = new Promise(function(resolve){
    //Creating the promise for the Applications Stories
    //Root admin privileges should allow him to access to all available applications. Otherwise check your environment's security rules for the designed user.      

      if(logging.log_mode || logging.log_mode_full) log.info("*** Loading the Stories List ***", logging.log_file);

      if(!logging.silent_mode) console.log();
      if(!logging.silent_mode) console.log("*****************************************************");
      if(!logging.silent_mode) console.log(" Loading the Application Stories and their Snapshots ");
      if(!logging.silent_mode) console.log("*****************************************************");

      if(logging.log_mode_full) log.debug("Preparing to call getDocList", logging.log_file);

      //Loading a list of all the available documents
      global.getDocList().then(function(documents) {

        if(logging.log_mode_full) log.debug("Received response from getDocList", logging.log_file);

        var available_docs = [];
        documents.forEach(function(document_entry){
          available_docs.push(document_entry.qDocId);
        });

        if(!logging.silent_mode) console.log("Processing each document");
        if(single_app){
          if(!logging.silent_mode) console.log("verifying user can access");

          if(logging.log_mode_full) log.debug("Single App mode - verifying user access", logging.log_file);

          var access_app = false;
          available_docs.forEach(function(application){
            if(application == conn_data.single_app_id)
              access_app = true;
          });

          if(access_app){
            if(logging.log_mode || logging.log_mode_full) log.info("Single App mode - User has access to this application", logging.log_file);
            getStories([conn_data.single_app_id]);
          }
          else{
            if(logging.log_mode || logging.log_mode_full) log.info("Single App mode - User has no access to this application", logging.log_file);
            resolve("Checkpoint: User has no access to this applications");
          }
        }else{
          if(available_docs.length>0){
            if(logging.log_mode || logging.log_mode_full) log.info("Processing each application", logging.log_file);
            getStories(available_docs);
          }
          else{
            if(logging.log_mode || logging.log_mode_full) log.info("The user has no available documents", logging.log_file);
            resolve("Checkpoint: The user has no available documents");
          }
        }      
      })

      //Loading stories from all the documents, one at the time
      function getStories(document_list){
        if(!logging.silent_mode) console.log("──────────────────────────────────────");
        var first_app = document_list.shift();
        if(!logging.silent_mode) console.log(" "+first_app);
        if(!logging.silent_mode) console.log("──────────────────────────────────────");

        if(logging.log_mode || logging.log_mode_full) log.info("Loading stories for application " + first_app, logging.log_file);

        //Configurations to open the first document (based on mindspank's https://github.com/mindspank/qsocks examples)
        var o = 'http://'+conn_data.origin;

        var config_app = {
          host: conn_data.server_address,
          isSecure: true,
          origin: o,
          rejectUnauthorized: false,
          appname: first_app,
          headers: {
            "Content-Type": "application/json",
            "Cookie": cookies[0]
          }
        }

        if(logging.log_mode_full) log.debug("Preparing to call Connect", logging.log_file);

        //Scoped connection for the document
        qsocks.Connect(config_app).then(function(global) {

          if(logging.log_mode_full) log.debug("Connected to engine", logging.log_file);
          if(logging.log_mode_full) log.debug("Preparing to call openDoc", logging.log_file);

          global.openDoc(config_app.appname,"","","",conn_data.no_data).then(function(app) {

            if(logging.log_mode_full) log.debug("Received response from openDoc", logging.log_file);
            if(logging.log_mode_full) log.debug("Preparing to call getAllInfos", logging.log_file);

            app.getAllInfos().then(function(appInfos){

              if(logging.log_mode_full) log.debug("Received response from getAllInfos", logging.log_file);
              if(logging.log_mode_full) log.debug("Filtering getAllInfos to Stories only", logging.log_file);

              var stories_list = [];
              appInfos.qInfos.forEach(function(document_infos){
                if(document_infos.qType=='story'){
                  stories_list.push(document_infos.qId)
                }
              })
              if(!logging.silent_mode) console.log(" Loading stories details:");
              if(logging.log_mode || logging.log_mode_full) log.info("Found " + stories_list.length + " stories. Loading details", logging.log_file);

              //Verifying if the document has stories
              if(stories_list.length>0)
                getStoriesDetails(stories_list); 
              else if(stories_list.length==0 && document_list.length>0){
                if(!logging.silent_mode) console.log();
                if(!logging.silent_mode) console.log(" Loaded all stories. Jumping to next application.");
                if(!logging.silent_mode) console.log(" Remaining applications: " + document_list.length);

                if(logging.log_mode || logging.log_mode_full) log.info("Loaded all stories. " + document_list.length + " remaining applications. Updating remaining list.", logging.log_file);

                getStories(document_list);
              }
              else if(stories_list.length==0 && document_list.length==0){ //checking if all stories and documents were processed
                if(logging.log_mode || logging.log_mode_full) log.info("All Applications Stories are loaded",logging.log_file);

                if(!logging.silent_mode) console.log("──────────────────────────────────────");
                resolve("Checkpoint: Applications Stories and Snapshots are loaded");
              }
              else{
                if(!logging.silent_mode) console.log("──────────────────────────────────────");
                console.log ("Shouldn't be here, something went wrong...");
                if(logging.log_mode || logging.log_mode_full) log.error("Shouldn't be here, something went wrong...", logging.log_file);
                // process.exit();
              }

              //Loading the stories of the document, one story at the time
              function getStoriesDetails(stories_list){
                var first_story = stories_list.shift();
                if(!logging.silent_mode) console.log(" - Story id: "+first_story);

                if(logging.log_mode || logging.log_mode_full) log.info("Loading story " + first_story,logging.log_file);
                if(logging.log_mode_full) log.debug("Preparing to call getObject", logging.log_file);

                app.getObject(first_story).then(function(str){

                  if(logging.log_mode_full) log.debug("Received response from getObject", logging.log_file);
                  if(logging.log_mode_full) log.debug("Preparing to call getLayout", logging.log_file);

                  //Loading the story's layout properties
                  str.getLayout().then(function(str_layout){

                    if(logging.log_mode_full) log.debug("Received response from getLayout", logging.log_file);

                    //Checking if the story has sheets
                    if(str_layout.qChildList.qItems.length>0){
                      if(!logging.silent_mode) console.log(" │  This story has some sheets");
                      var str_sheets_list = [];

                      str_layout.qChildList.qItems.forEach(function(story_sheet){
                        str_sheets_list.push(story_sheet.qInfo.qId);
                      })

                      if(str_sheets_list.length>0){
                        if(logging.log_mode || logging.log_mode_full) log.info("Found " + str_sheets_list.length + " story sheets. Loading details", logging.log_file);
                        getStorySheetsDetails(str_sheets_list);
                      }
                      else{
                        if(!logging.silent_mode) console.log("   This is an empty story");

                        if(logging.log_mode || logging.log_mode_full) log.info("This is an empty story.", logging.log_file);
                        if(logging.log_mode_full) log.debug("Preparing data for *_Story_* XML file storage", logging.log_file);

                        //Setting up data and options for XML file storage
                        var str_data = {
                          str_layout
                        };

                        var options = {
                          useCDATA: true
                        };

                        var xml_sheet = js2xmlparser.parse("story", str_data, options);

                        //Storing XML with the story's data
                        fs.writeFile("AppStructures/"+config_app.appname+"_Story_"+first_story+"_"+conn_data.user_directory + "_" + conn_data.user_name+".xml", xml_sheet, function(err) {
                          if (err){
                            if(logging.log_mode || logging.log_mode_full) log.warning("Unable to store AppStructures/"+config_app.appname+"_Story_"+first_story+"_"+conn_data.user_directory + "_" + conn_data.user_name+".xml: " + err, logging.log_file);
                            throw err;
                          }else{
                            if(logging.log_mode || logging.log_mode_full) log.info("Stored AppStructures/"+config_app.appname+"_Story_"+first_story+"_"+conn_data.user_directory + "_" + conn_data.user_name+".xml", logging.log_file);

                            if(!logging.silent_mode) console.log(' - '+config_app.appname+'_Story_'+first_story+'_'+conn_data.user_directory + '_' + conn_data.user_name+'.xml file saved');
                            if(!logging.silent_mode) console.log('- - - - - - - - - - - - - - - - - - - ');
                            if(!logging.silent_mode) console.log(" Updating the remaining stories list");
                            if(!logging.silent_mode) console.log(" This is the stories list length: "+stories_list.length);
                            if(!logging.silent_mode) console.log('- - - - - - - - - - - - - - - - - - - ');
                          }
                          //Checking if all the stories were processed
                          if(stories_list.length>0){
                            if(logging.log_mode || logging.log_mode_full) log.info(stories_list.length + " remaining stories. Updating remaining list.", logging.log_file);
                            getStoriesDetails(stories_list);
                          }
                          else if (stories_list.length==0 && document_list.length>0){
                            if(!logging.silent_mode) console.log(" Loaded all stories. Jumping to next application.");
                            if(!logging.silent_mode) console.log(" Remaining applications: " + document_list.length);

                            if(logging.log_mode || logging.log_mode_full) log.info("Loaded all stories. " + document_list.length + " remaining applications. Updating remaining list.", logging.log_file);

                            getStories(document_list);
                          }
                          else if (stories_list.length==0 && document_list==0){ //checking if all stories and documents were processed
                            if(logging.log_mode || logging.log_mode_full) log.info("All Applications Stories are loaded",logging.log_file);

                            if(!logging.silent_mode) console.log("──────────────────────────────────────");
                            resolve("Checkpoint: Applications Stories and Snapshots are loaded");
                          } 
                          else {
                            if(!logging.silent_mode) console.log("──────────────────────────────────────");
                            console.log ("Shouldn't be here, something went wrong...");
                            if(logging.log_mode || logging.log_mode_full) log.error("Shouldn't be here, something went wrong...", logging.log_file);
                            // process.exit();
                          }
                        })
                      }

                      //Loading the story sheets details, one sheet at the time
                      function getStorySheetsDetails(str_sheets_list){

                        var first_story_sheet = str_sheets_list.shift();
                        if(!logging.silent_mode) console.log(" ├- Story Sheet Id: " + first_story_sheet);

                        if(logging.log_mode || logging.log_mode_full) log.info("Loading story sheet " + first_story_sheet,logging.log_file);
                        if(logging.log_mode_full) log.debug("Preparing to call getChild", logging.log_file);

                        str.getChild(first_story_sheet).then(function(str_sht){

                          if(logging.log_mode_full) log.debug("Received response from getChild", logging.log_file);
                          if(logging.log_mode_full) log.debug("Preparing to call getLayout", logging.log_file);

                          //Loading the sheet's layout properties
                          str_sht.getLayout().then(function(str_sht_layout){

                            if(logging.log_mode_full) log.debug("Received response from getLayout", logging.log_file);

                            //Verifying if the sheet has objects
                            if(str_sht_layout.qChildList.qItems.length>0){
                              if(!logging.silent_mode) console.log(" │└- This story sheet has some items. Let me get the snapshots first.");
                              var str_sht_items_snapshots = [];
                              //Focusing in the snapshots for additional object information
                              str_sht_layout.qChildList.qItems.forEach(function(slide_item){
                                if(slide_item.qData.visualization=='snapshot')
                                  str_sht_items_snapshots.push(slide_item.qInfo.qId);
                              })

                              if(str_sht_items_snapshots.length>0){ //there are snapshots in the slide
                                if(logging.log_mode || logging.log_mode_full) log.info("Found " + str_sht_items_snapshots.length + " snapshots in the slide. Loading details", logging.log_file);
                                getStorySnapshotsDetails(str_sht_items_snapshots);
                              }else{ //there are no snapshots in the slide
                                if(!logging.silent_mode) console.log(" │   There are no snapshots in this slide");
                                if(!logging.silent_mode) console.log(" │   Storing the rest of the slide items");

                                if(logging.log_mode || logging.log_mode_full) log.info("There are no snapshots in the slide.", logging.log_file);
                                if(logging.log_mode_full) log.debug("Preparing data for *_StorySlideItems_* XML file storage", logging.log_file);

                                //slide items
                                var str_sht_items_other = [];

                                str_sht_layout.qChildList.qItems.forEach(function(slide_item){
                                  if(slide_item.qData.visualization!='snapshot'){
                                    str_sht_items_other.push(slide_item);
                                  }
                                })

                                //Setting up data and options for XML file storage
                                var str_sht_other_details = {
                                  slideitems: str_sht_items_other
                                }

                                var options = {
                                  useCDATA: true
                                }

                                var xml_story_sheet_slideitems = js2xmlparser.parse("storySheetSlideItems", str_sht_other_details, options);

                                //Storing XML with the slideitem's data
                                fs.writeFile("AppStructures/"+config_app.appname+"_StorySlideItems_"+first_story+"_"+first_story_sheet+"_"+conn_data.user_directory + "_" + conn_data.user_name+".xml", xml_story_sheet_slideitems, function(err) {
                                  if (err) {
                                    if(logging.log_mode || logging.log_mode_full) log.warning("Unable to store AppStructures/"+config_app.appname+"_StorySlideItems_"+first_story+"_"+first_story_sheet+"_"+conn_data.user_directory + "_" + conn_data.user_name+".xml: " + err, logging.log_file);
                                    throw err;
                                  }else{
                                    if(logging.log_mode || logging.log_mode_full) log.info("Stored AppStructures/"+config_app.appname+"_StorySlideItems_"+first_story+"_"+first_story_sheet+"_"+conn_data.user_directory + "_" + conn_data.user_name+".xml", logging.log_file);
                                    if(logging.log_mode_full) log.debug("Preparing data for *_StorySlide_* XML file storage", logging.log_file);

                                    if(!logging.silent_mode) console.log(' │ - '+config_app.appname+'_StorySlideItems_'+first_story+'_'+first_story_sheet+'_'+conn_data.user_directory + '_' + conn_data.user_name+'.xml file saved');
                                    if(!logging.silent_mode) console.log(" │   Storing the slide data");
                                  }

                                  //Setting up data and options for XML file storage
                                  var slide_data = {
                                    qInfo: str_sht_layout.qInfo,
                                    rank: str_sht_layout.rank
                                  }

                                  var options = {
                                    useCDATA: true
                                  }

                                  var xml_story_sheet = js2xmlparser.parse("storySheet", slide_data, options);

                                  //Storing XML with the slide's data
                                  fs.writeFile("AppStructures/"+config_app.appname+"_StorySlide_"+first_story+"_"+first_story_sheet+".xml", xml_story_sheet, function(err) {
                                    if (err) {
                                      if(logging.log_mode || logging.log_mode_full) log.warning("Unable to store AppStructures/"+config_app.appname+"_StorySlide_"+first_story+"_"+first_story_sheet+".xml: " + err, logging.log_file);
                                      throw err;
                                    }else{
                                      if(logging.log_mode || logging.log_mode_full) log.info("Stored AppStructures/"+config_app.appname+"_StorySlide_"+first_story+"_"+first_story_sheet+".xml", logging.log_file);

                                      if(!logging.silent_mode) console.log(' │ - '+config_app.appname+'_StorySlide_'+first_story+'_'+first_story_sheet+'.xml file saved');
                                      if(!logging.silent_mode) console.log('- - - - - - - - - - - - - - - - - - - ');
                                      if(!logging.silent_mode) console.log(" Updating the remaining slides list");
                                      if(!logging.silent_mode) console.log(" This is the slides list length: "+str_sheets_list.length);
                                      if(!logging.silent_mode) console.log('- - - - - - - - - - - - - - - - - - - ');}
                                    //Checking if all the slides were processed
                                    if(str_sheets_list.length>0){
                                      if(logging.log_mode || logging.log_mode_full) log.info(str_sheets_list.length + " remaining story sheets. Updating remaining list.", logging.log_file);
                                      getStorySheetsDetails(str_sheets_list);
                                    }
                                    else{
                                      if(logging.log_mode || logging.log_mode_full) log.info("Finished the sheets for the story "+first_story, logging.log_file);
                                      if(logging.log_mode_full) log.debug("Preparing data for *_Story_* XML file storage", logging.log_file);

                                      if(!logging.silent_mode) console.log("   This story is loaded");
                                      //Setting up data and options for XML file storage
                                      var str_data = {
                                        str_layout
                                      };

                                      var options = {
                                        useCDATA: true
                                      };

                                      var xml_sheet = js2xmlparser.parse("story", str_data, options);
                                      //Storing XML with the story's data
                                      fs.writeFile("AppStructures/"+config_app.appname+"_Story_"+first_story+"_"+conn_data.user_directory + "_" + conn_data.user_name+".xml", xml_sheet, function(err) {
                                      if (err) {
                                        if(logging.log_mode || logging.log_mode_full) log.warning("Unable to store AppStructures/"+config_app.appname+"_Story_"+first_story+"_"+conn_data.user_directory + "_" + conn_data.user_name+".xml: " + err, logging.log_file);
                                        throw err;
                                      }else{
                                        if(logging.log_mode || logging.log_mode_full) log.info("Stored AppStructures/"+config_app.appname+"_Story_"+first_story+"_"+conn_data.user_directory + "_" + conn_data.user_name+".xml", logging.log_file);

                                        if(!logging.silent_mode) console.log(' - '+config_app.appname+'_Story_'+first_story+'_'+conn_data.user_directory + '_' + conn_data.user_name+'.xml file saved');
                                      }
                                        if(stories_list.length>0){
                                          if(!logging.silent_mode) console.log('... ... ... ... ... ... ... ... ... ..');
                                          if(!logging.silent_mode) console.log(" Loaded all slides. Jumping to the next story");
                                          if(!logging.silent_mode) console.log(" Stories remaining: " + stories_list.length);
                                          if(!logging.silent_mode) console.log('... ... ... ... ... ... ... ... ... ..');

                                          if(logging.log_mode || logging.log_mode_full) log.info("Loaded all slides", logging.log_file);
                                          if(logging.log_mode || logging.log_mode_full) log.info(stories_list.length + " remaining stories. Updating remaining list.", logging.log_file);

                                          getStoriesDetails(stories_list);
                                        }
                                        else if(stories_list.length==0 && document_list.length>0){ //no more slides, no more stories, more apps
                                          if(!logging.silent_mode) console.log(" Loaded all stories. Jumping to next application.");
                                          if(!logging.silent_mode) console.log(" Remaining applications: " + document_list.length);

                                          if(logging.log_mode || logging.log_mode_full) log.info("Loaded all stories. " + document_list.length + " remaining applications. Updating remaining list.", logging.log_file);

                                          getStories(document_list);
                                        }
                                        else if(stories_list.length==0 && document_list.length==0){ //no more slides, no more stories, no more apps
                                          if(logging.log_mode || logging.log_mode_full) log.info("All Applications Stories are loaded",logging.log_file);

                                          if(!logging.silent_mode) console.log("──────────────────────────────────────");
                                          resolve("Checkpoint: Applications Stories and Snapshots are loaded");
                                        }
                                        else{
                                          if(!logging.silent_mode) console.log("──────────────────────────────────────");
                                          console.log ("Shouldn't be here, something went wrong...");
                                          if(logging.log_mode || logging.log_mode_full) log.error("Shouldn't be here, something went wrong...", logging.log_file);
                                          // process.exit();
                                        }
                                      })//writefile Story  
                                    }
                                  })//writefile StorySlide
                                })//writefile StorySlideItems
                              }

                              //Loading the story snapshots details, one snapshot at the time
                              function getStorySnapshotsDetails(str_sht_items_snapshots){

                                var first_snapshot = str_sht_items_snapshots.shift();
                                if(!logging.silent_mode) console.log(" │ - Snapshot Id: " + first_snapshot);

                                if(logging.log_mode || logging.log_mode_full) log.info("Loading story sheet snapshot" + first_snapshot,logging.log_file);
                                if(logging.log_mode_full) log.debug("Preparing to call getChild", logging.log_file);

                                str_sht.getChild(first_snapshot).then(function(str_sht_snpsht){

                                  if(logging.log_mode_full) log.debug("Received response from getChild", logging.log_file);
                                  if(logging.log_mode_full) log.debug("Preparing to call getLayout", logging.log_file);

                                  //Loading the snapshot's layout properties
                                  str_sht_snpsht.getLayout().then(function(str_sht_snpsht_layout){

                                    if(logging.log_mode_full) log.debug("Received response from getLayout", logging.log_file);
                                    if(logging.log_mode_full) log.debug("Preparing data for *_StorySnapshot_* XML file storage", logging.log_file);

                                    //Setting up data and options for XML file storage
                                    
                                    str_sht_snpsht_layout = {
                                      qInfo: str_sht_snpsht_layout.qInfo,
                                      visualization: str_sht_snpsht_layout.visualization,
                                      visualizationType: str_sht_snpsht_layout.visualizationType,
                                      qEmbeddedSnapshot: {
                                          showTitles: str_sht_snpsht_layout.qEmbeddedSnapshot.showTitles,
                                          title: str_sht_snpsht_layout.qEmbeddedSnapshot.title,
                                          sheetId: str_sht_snpsht_layout.qEmbeddedSnapshot.sheetId,
                                          creationDate: str_sht_snpsht_layout.qEmbeddedSnapshot.creationDate,
                                          visualization: str_sht_snpsht_layout.qEmbeddedSnapshot.visualization,
                                          sourceObjectId: str_sht_snpsht_layout.qEmbeddedSnapshot.sourceObjectId,
                                          timestamp: str_sht_snpsht_layout.qEmbeddedSnapshot.timestamp
                                      },
                                      style: str_sht_snpsht_layout.style
                                    }

                                    var snapshot_data = {
                                      str_sht_snpsht_layout
                                    };
                                    
                                    var options = {
                                      useCDATA: true
                                    }

                                    var xml_story_sheet_snapshot = js2xmlparser.parse("storySheetSnapshot", snapshot_data, options); 

                                    //Storing XML with the snapshot's data
                                    fs.writeFile("AppStructures/"+config_app.appname+"_StorySnapshot_"+first_story+"_"+first_story_sheet+"_"+first_snapshot+".xml", xml_story_sheet_snapshot, function(err) {
                                      if (err) {
                                        if(logging.log_mode || logging.log_mode_full) log.warning("Unable to store AppStructures/"+config_app.appname+"_StorySnapshot_"+first_story+"_"+first_story_sheet+"_"+first_snapshot+".xml: " + err, logging.log_file);
                                        throw err;
                                      }else{
                                        if(!logging.silent_mode) console.log(' │ - '+config_app.appname+'_StorySnapshot_'+first_story+'_'+first_story_sheet+'_'+first_snapshot+'.xml file saved');
                                        if(!logging.silent_mode) console.log(" │   Updating the remaining snapshots list for this sheet's story");
                                        if(!logging.silent_mode) console.log(" │   This is the snapshots list length: "+str_sht_items_snapshots.length);

                                        if(logging.log_mode || logging.log_mode_full) log.info("Stored AppStructures/"+config_app.appname+"_StorySnapshot_"+first_story+"_"+first_story_sheet+"_"+first_snapshot+".xml", logging.log_file);
                                      }
                                      //Checking if all the snapshots were processed
                                      if(str_sht_items_snapshots.length>0){
                                        if(logging.log_mode || logging.log_mode_full) log.info("Found " + str_sht_items_snapshots.length + " snapshots in the slide. Loading details", logging.log_file);
                                        getStorySnapshotsDetails(str_sht_items_snapshots);
                                      }
                                      else{ //snapshots done, other slide items and next slide
                                        if(!logging.silent_mode) console.log(" │ - Finished the snapshots for sheet's story "+first_story);
                                        if(!logging.silent_mode) console.log(" │   Storing the rest of the slide items");

                                        if(logging.log_mode || logging.log_mode_full) log.info("Finished the snapshots for sheet's story", logging.log_file);
                                        if(logging.log_mode_full) log.debug("Preparing data for *_StorySlideItems_* XML file storage", logging.log_file);

                                        //slide items
                                        var str_sht_items_other = [];

                                        str_sht_layout.qChildList.qItems.forEach(function(slide_item){
                                          if(slide_item.qData.visualization!='snapshot'){
                                            str_sht_items_other.push(slide_item);
                                          }
                                        })

                                        var str_sht_other_details = {
                                          slideitems: str_sht_items_other
                                        }

                                        //Setting up data for XML file storage
                                        var options = {
                                          useCDATA: true
                                        }

                                        var xml_story_sheet_slideitems = js2xmlparser.parse("storySheetSlideItems", str_sht_other_details, options);

                                        //Storing XML with the slideitem's data
                                        fs.writeFile("AppStructures/"+config_app.appname+"_StorySlideItems_"+first_story+"_"+first_story_sheet+".xml", xml_story_sheet_slideitems, function(err) {
                                          if (err) {
                                            if(logging.log_mode || logging.log_mode_full) log.warning("Unable to store AppStructures/"+config_app.appname+"_StorySlideItems_"+first_story+"_"+first_story_sheet+".xml: " + err, logging.log_file);
                                            throw err;
                                          }else{
                                            if(!logging.silent_mode) console.log(' │ - '+config_app.appname+'_StorySlideItems_'+first_story+'_'+first_story_sheet+'.xml file saved');
                                            if(!logging.silent_mode) console.log(" │   Storing the slide data");

                                            if(logging.log_mode || logging.log_mode_full) log.info("Stored AppStructures/"+config_app.appname+"_StorySlideItems_"+first_story+"_"+first_story_sheet+".xml", logging.log_file);
                                            if(logging.log_mode_full) log.debug("Preparing data for *_StorySlide_* XML file storage", logging.log_file);
                                          }

                                          //Setting up data and options for XML file storage
                                          var slide_data = {
                                            qInfo: str_sht_layout.qInfo,
                                            rank: str_sht_layout.rank
                                          }

                                          var options = {
                                            useCDATA: true
                                          }

                                          var xml_story_sheet = js2xmlparser.parse("storySheet", slide_data, options);

                                          //Storing XML with the slide's data
                                          fs.writeFile("AppStructures/"+config_app.appname+"_StorySlide_"+first_story+"_"+first_story_sheet+".xml", xml_story_sheet, function(err) {
                                            if (err) {
                                              if(logging.log_mode || logging.log_mode_full) log.warning("Unable to store AppStructures/"+config_app.appname+"_StorySlide_"+first_story+"_"+first_story_sheet+".xml: " + err, logging.log_file);
                                              throw err;
                                            }else{
                                              if(!logging.silent_mode) console.log(' │ - '+config_app.appname+'_StorySlide_'+first_story+'_'+first_story_sheet+'.xml file saved');
                                              if(!logging.silent_mode) console.log('- - - - - - - - - - - - - - - - - - - ');
                                              if(!logging.silent_mode) console.log(" Updating the remaining slides list");
                                              if(!logging.silent_mode) console.log(" This is the slides list length: "+str_sheets_list.length);
                                              if(!logging.silent_mode) console.log('- - - - - - - - - - - - - - - - - - - ');

                                              if(logging.log_mode || logging.log_mode_full) log.info("Stored AppStructures/"+config_app.appname+"_StorySlide_"+first_story+"_"+first_story_sheet+".xml", logging.log_file);
                                            }
                                            //Checking if all the slides were processed
                                            if(str_sheets_list.length>0){
                                              if(logging.log_mode || logging.log_mode_full) log.info(str_sheets_list.length + " remaining story sheets. Updating remaining list.", logging.log_file);
                                              getStorySheetsDetails(str_sheets_list);
                                            }
                                            else{
                                              if(logging.log_mode || logging.log_mode_full) log.info("Finished the sheets for the story "+first_story, logging.log_file);
                                              if(logging.log_mode_full) log.debug("Preparing data for *_Story_* XML file storage", logging.log_file);

                                              if(!logging.silent_mode) console.log("   This story is loaded");
                                              //Setting up data and options for XML file storage
                                              var str_data = {
                                                str_layout
                                              };

                                              var options = {
                                                useCDATA: true
                                              };

                                              var xml_sheet = js2xmlparser.parse("story", str_data, options);
                                              //Storing XML with the story's data
                                              fs.writeFile("AppStructures/"+config_app.appname+"_Story_"+first_story+"_"+conn_data.user_directory + "_" + conn_data.user_name+".xml", xml_sheet, function(err) {
                                                if (err) {
                                                  if(logging.log_mode || logging.log_mode_full) log.warning("Unable to store AppStructures/"+config_app.appname+"_Story_"+first_story+"_"+conn_data.user_directory + "_" + conn_data.user_name+".xml: " + err, logging.log_file);
                                                  throw err;
                                                }else{
                                                  if(logging.log_mode || logging.log_mode_full) log.info("Stored AppStructures/"+config_app.appname+"_Story_"+first_story+"_"+conn_data.user_directory + "_" + conn_data.user_name+".xml", logging.log_file);
                                                  if(!logging.silent_mode) console.log(' - '+config_app.appname+'_Story_'+first_story+first_story+"_"+conn_data.user_directory + "_" + conn_data.user_name+'.xml file saved');
                                                }

                                                if(stories_list.length>0){
                                                  if(!logging.silent_mode) console.log('... ... ... ... ... ... ... ... ... ..');
                                                  if(!logging.silent_mode) console.log(" Loaded all slides. Jumping to the next story");
                                                  if(!logging.silent_mode) console.log(" Stories remaining: " + stories_list.length);
                                                  if(!logging.silent_mode) console.log('... ... ... ... ... ... ... ... ... ..');

                                                  if(logging.log_mode || logging.log_mode_full) log.info("Loaded all slides", logging.log_file);
                                                  if(logging.log_mode || logging.log_mode_full) log.info(stories_list.length + " remaining stories. Updating remaining list.", logging.log_file);

                                                  getStoriesDetails(stories_list);
                                                }
                                                else if(stories_list.length==0 && document_list.length>0){ //no more slides, no more stories, more apps
                                                  if(!logging.silent_mode) console.log(" Loaded all stories. Jumping to next application.");
                                                  if(!logging.silent_mode) console.log(" Remaining applications: " + document_list.length);

                                                  if(logging.log_mode || logging.log_mode_full) log.info("Loaded all stories. " + document_list.length + " remaining applications. Updating remaining list.", logging.log_file);

                                                  getStories(document_list);
                                                }
                                                else if(stories_list.length==0 && document_list.length==0){ //no more slides, no more stories, no more apps
                                                  if(logging.log_mode || logging.log_mode_full) log.info("All Applications Stories are loaded",logging.log_file);

                                                  if(!logging.silent_mode) console.log("──────────────────────────────────────");
                                                  resolve("Checkpoint: Applications Stories and Snapshots are loaded");
                                                }else{
                                                  if(!logging.silent_mode) console.log("──────────────────────────────────────");
                                                  console.log ("Shouldn't be here, something went wrong...");
                                                  if(logging.log_mode || logging.log_mode_full) log.error("Shouldn't be here, something went wrong...", logging.log_file);
                                                  //process.exit();
                                                }
                                              })//writefile Story  
                                            }
                                          })//writefile StorySlide
                                        })//writefile StorySlideItems
                                      }
                                    })
                                  })//str_sht_snpsht.getLayout()
                                })//str_sht.getChild(first_snapshot) - refers to the sheet snapshot item
                              } //getStorySnapshotsDetails
                            }//if(str_layout.qChildList.qItems.length>0) - refers to sheet items
                            else{
                              if(!logging.silent_mode) console.log(" │   This is an empty slide");
                              if(!logging.silent_mode) console.log(" │   Storing the slide data");

                              if(logging.log_mode || logging.log_mode_full) log.info("This is an empty story slide", logging.log_file);
                              if(logging.log_mode_full) log.debug("Preparing data for *_StorySlide_* XML file storage", logging.log_file);

                              //Setting up data and options for XML file storage
                              var slide_data = {
                                qInfo: str_sht_layout.qInfo,
                                rank: str_sht_layout.rank
                              }

                              var options = {
                                useCDATA: true
                              }

                              var xml_story_sheet = js2xmlparser.parse("storySheet", slide_data, options);

                              //Storing XML with the slide's data
                              fs.writeFile('AppStructures/'+config_app.appname+'_StorySlide_'+first_story+'_'+first_story_sheet+'.xml', xml_story_sheet, function(err) {
                                if (err) {
                                  if(logging.log_mode || logging.log_mode_full) log.warning("Unable to store AppStructures/"+config_app.appname+"_StorySlide_"+first_story+"_"+first_story_sheet+".xml: " + err, logging.log_file);
                                  throw err;
                                }else{
                                  if(!logging.silent_mode) console.log(' │ - '+config_app.appname+'_StorySlide_'+first_story+'_'+first_story_sheet+'.xml file saved');
                                  if(!logging.silent_mode) console.log('- - - - - - - - - - - - - - - - - - - ');
                                  if(!logging.silent_mode) console.log(" Updating the remaining slides list");
                                  if(!logging.silent_mode) console.log(" This is the slides list length: "+str_sheets_list.length);
                                  if(!logging.silent_mode) console.log('- - - - - - - - - - - - - - - - - - - ');

                                  if(logging.log_mode || logging.log_mode_full) log.info("Stored AppStructures/"+config_app.appname+"_StorySlide_"+first_story+"_"+first_story_sheet+".xml", logging.log_file);
                                }
                                //Checking if all the slides were processed
                                if(str_sheets_list.length>0){
                                  if(logging.log_mode || logging.log_mode_full) log.info(str_sheets_list.length + " remaining story sheets. Updating remaining list.", logging.log_file);
                                  getStorySheetsDetails(str_sheets_list);
                                }else{
                                  if(!logging.silent_mode) console.log("   This story is loaded");

                                  if(logging.log_mode || logging.log_mode_full) log.info("Finished the sheets for the story "+first_story, logging.log_file);
                                  if(logging.log_mode_full) log.debug("Preparing data for *_Story_* XML file storage", logging.log_file);

                                  //Setting up data and options for XML file storage
                                  var str_data = {
                                    str_layout
                                  };

                                  var options = {
                                    useCDATA: true
                                  };

                                  var xml_sheet = js2xmlparser.parse("story", str_data, options);
                                  //Storing XML with the story's data
                                  fs.writeFile("AppStructures/"+config_app.appname+"_Story_"+first_story+"_"+conn_data.user_directory + "_" + conn_data.user_name+".xml", xml_sheet, function(err) {
                                    if (err) {
                                      if(logging.log_mode || logging.log_mode_full) log.warning("Unable to store AppStructures/"+config_app.appname+"_Story_"+first_story+"_"+conn_data.user_directory + "_" + conn_data.user_name+".xml: " + err, logging.log_file);
                                      throw err;
                                    }else{
                                      if(!logging.silent_mode) console.log(' - '+config_app.appname+'_Story_'+first_story+'.xml file saved');
                                      if(logging.log_mode || logging.log_mode_full) log.info("Stored AppStructures/"+config_app.appname+"_Story_"+first_story+"_"+conn_data.user_directory + "_" + conn_data.user_name+".xml", logging.log_file);
                                    }
                                    if(stories_list.length>0){

                                      if(!logging.silent_mode) console.log('... ... ... ... ... ... ... ... ... ..');
                                      if(!logging.silent_mode) console.log(" Loaded all slides. Jumping to the next story");
                                      if(!logging.silent_mode) console.log(" Stories remaining: " + stories_list.length);
                                      if(!logging.silent_mode) console.log('... ... ... ... ... ... ... ... ... ..');

                                      if(logging.log_mode || logging.log_mode_full) log.info("Loaded all slides", logging.log_file);
                                      if(logging.log_mode || logging.log_mode_full) log.info(stories_list.length + " remaining stories. Updating remaining list.", logging.log_file);

                                      getStoriesDetails(stories_list);
                                    }
                                    else if(stories_list.length==0 && document_list.length>0){ //no more slides, no more stories, more apps
                                      if(!logging.silent_mode) console.log(" Loaded all stories. Jumping to next application.");
                                      if(!logging.silent_mode) console.log(" Remaining applications: " + document_list.length);

                                      if(logging.log_mode || logging.log_mode_full) log.info("Loaded all stories. " + document_list.length + " remaining applications. Updating remaining list.", logging.log_file);

                                      getStories(document_list);
                                    }
                                    else if(stories_list.length==0 && document_list.length==0){ //no more slides, no more stories, no more apps
                                      if(logging.log_mode || logging.log_mode_full) log.info("All Applications Stories are loaded",logging.log_file);

                                      if(!logging.silent_mode) console.log("──────────────────────────────────────");
                                      resolve("Checkpoint: Applications Stories and Snapshots are loaded");
                                    }else{
                                      if(!logging.silent_mode) console.log("──────────────────────────────────────");
                                      console.log ("Shouldn't be here, something went wrong...");
                                      if(logging.log_mode || logging.log_mode_full) log.error("Shouldn't be here, something went wrong...", logging.log_file);
                                      // process.exit();
                                    }
                                  })//writefile Story  
                                }
                              })//writefile StorySlide
                            }
                          })//str_sht.getLayout()
                        })//str.getChild(first_story_sheet)
                      }//getStorySheetsDetails
                    }//if(str_layout.qChildList.length>0) - refers to sheets in the story
                  })//str.getLayout
                })//app.getObject
              }//getStoriesDetails
            })
          })
        })
      }
    });//promise
    return promise_str;
  }//getAppStories
}//module exports