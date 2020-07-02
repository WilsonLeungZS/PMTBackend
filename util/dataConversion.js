function weekConversionToNumber(dayOfWeek){
  if(dayOfWeek == 'Sunday'){
    return 0;
  }else if(dayOfWeek == 'Monday'){
    return 1;
  }else if(dayOfWeek == 'Thuesday'){
    return 2;
  }else if(dayOfWeek == 'Wednesday'){
    return 3;
  }else if(dayOfWeek == 'Thursday'){
    return 4;
  }else if(dayOfWeek == 'Friday'){
    return 5;
  }else if(dayOfWeek == 'Saturday'){
    return 6;
  }
}

function rankConversionToNumber(rank){
  if(rank == 'First'){
    return 1;
  }else if(rank == 'Second'){
    return 2;
  }else if(rank == 'Third'){
    return 3;
  }else if(rank == 'Forth'){
    return 4;
  }
}

module.exports = {
  weekConversionToNumber,
  rankConversionToNumber
}