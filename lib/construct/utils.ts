

export namespace Utils {
  export function createStateName(stateNamePrefix: string, name: string): string {
    const nameLengthError: string = 'Error: Stepfunction State Names must be less than 80 Characters long, please re-specify the name prefix to try and stay within these service limits';
    try {
      let stateNameToReturn = name;
      if (stateNamePrefix.length > 0) {
        stateNameToReturn = `${stateNamePrefix}-${name}`;
      }
      if (stateNameToReturn.length > 80) {
        throw new Error(nameLengthError);

      }
      return stateNameToReturn;
    }
    catch (e) {
      console.log(e);
      return nameLengthError;
    }
  }
}