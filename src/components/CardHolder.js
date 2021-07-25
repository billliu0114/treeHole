import EntryCards from "./EntryCards";
import {Grid, Box}  from '@material-ui/core/';
import JournalCalendar from './JournalCalendar'
   
export function CardHolder({showCalendar, journals}){

    const updateJournal = (journal_id, newJournal) => {
        // check if the newJournal is in the valid format
        if (Object.keys(newJournal).length > 0) {
            let index = journals.findIndex((journal)=>{
                return journal._id===journal_id;
            });
            let newJournals = [...journals];
            newJournals[index] = newJournal;
            // setJournals(newJournals);
        }
    }

    return (
        <>
            <Box m={5} mt={0}>
                <Grid
                    container
                    direction="row"
                    justify="center"
                    alignItems="center"
                    spacing={3}>
                    {showCalendar&&<><Grid item xs={12} sm = {6} md={4} lg = {3}>
                        <JournalCalendar/>
                    </Grid></>}
                        
                {journals.map((journal) => (
                    <Grid key={journal._id} item xs={12} sm = {6} md={4} lg = {3}>
                        <EntryCards
                            content={journal}
                            updateJournal = {updateJournal}
                        />
                    </Grid>
                ))}
              </Grid>
            </Box>
          </>
      );

}

export default CardHolder;